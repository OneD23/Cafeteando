import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api/client';
import { DEFAULT_INGREDIENTS } from '../data/offlineDefaults';

interface InventoryIngredient {
  id: string;
  [key: string]: any;
}

interface InventoryState {
  ingredients: InventoryIngredient[];
  movements: any[];
  loading: boolean;
  error: string | null;
  lastSync: string | null;
  lowStockAlerts: string[];
}

const roundQuantity = (value: number): number =>
  Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

// Thunks para API
export const fetchIngredients = createAsyncThunk(
  'inventory/fetchIngredients',
  async () => {
    const response = await api.getIngredients();
    return response.data;
  }
);

export const addIngredient = createAsyncThunk(
  'inventory/addIngredient',
  async (ingredientData: any) => {
    const response = await api.createIngredient(ingredientData);
    return response.data;
  }
);

export const updateIngredient = createAsyncThunk(
  'inventory/updateIngredient',
  async (ingredientData: any) => {
    const id = String(ingredientData.id || ingredientData._id || '');
    const response = await api.updateIngredient(id, ingredientData);
    return response.data;
  }
);

export const deleteIngredient = createAsyncThunk(
  'inventory/deleteIngredient',
  async (id: string) => {
    await api.deleteIngredient(id);
    return id;
  }
);

export const restockIngredient = createAsyncThunk(
  'inventory/restockIngredient',
  async ({ ingredientId, quantity, reason }: { ingredientId: string; quantity: number; reason?: string }) => {
    const response = await api.restockIngredient(ingredientId, quantity, reason);
    return response.data;
  }
);

export const adjustStock = createAsyncThunk(
  'inventory/adjustStock',
  async ({ ingredientId, newStock, reason }: { ingredientId: string; newStock: number; reason: string }) => {
    const response = await api.adjustStock(ingredientId, newStock, reason);
    return response.data;
  }
);

export const deductIngredientsForSale = createAsyncThunk(
  'inventory/deductIngredientsForSale',
  async ({ recipeId, quantity, saleId }: { recipeId: string; quantity: number; saleId: string }) => {
    const response = await api.deductIngredients(recipeId, quantity, saleId);
    return response.data;
  }
);

const initialState: InventoryState = {
  ingredients: DEFAULT_INGREDIENTS,
  movements: [],
  loading: false,
  error: null,
  lastSync: null,
  lowStockAlerts: [],
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setIngredients: (state, action) => {
      state.ingredients = action.payload;
      state.lastSync = new Date().toISOString();
    },
    setMovements: (state, action: PayloadAction<any[]>) => {
      state.movements = action.payload || [];
    },
    consumeIngredients: (state, action: PayloadAction<{
      recipeItems: Array<{ ingredientId: string; quantity: number }>;
      quantity: number;
      saleId: string;
      productName: string;
    }>) => {
      const { recipeItems, quantity, saleId, productName } = action.payload;

      recipeItems.forEach((ri) => {
        const index = state.ingredients.findIndex((i: any) => i.id === ri.ingredientId);
        if (index !== -1) {
          const ingredient: any = state.ingredients[index];
          const deductQty = roundQuantity(ri.quantity * quantity);
          const previousStock = ingredient.stock;

          ingredient.stock = roundQuantity(Math.max(0, ingredient.stock - deductQty));

          state.movements.push({
            id: `mov-${Date.now()}-${ri.ingredientId}`,
            type: 'sale',
            ingredientId: ri.ingredientId,
            quantity: -deductQty,
            date: new Date().toISOString(),
            reason: `Venta: ${productName}`,
            saleId,
            previousStock,
            newStock: ingredient.stock,
          });
        }
      });

      state.lowStockAlerts = state.ingredients
        .filter((ing: any) => ing.stock <= ing.minStock)
        .map((ing: any) => ing.id);
      state.lastSync = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchIngredients
      .addCase(fetchIngredients.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchIngredients.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients = action.payload;
        state.lowStockAlerts = action.payload
          .filter((ing: any) => ing.stock <= ing.minStock)
          .map((ing: any) => ing.id);
      })
      .addCase(fetchIngredients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      // addIngredient
      .addCase(addIngredient.pending, (state) => {
        state.loading = true;
      })
      .addCase(addIngredient.fulfilled, (state, action) => {
        state.loading = false;
        state.ingredients.push(action.payload);
      })
      .addCase(addIngredient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      // updateIngredient
      .addCase(updateIngredient.fulfilled, (state, action) => {
        const index = state.ingredients.findIndex((i: any) => i.id === action.payload.id);
        if (index !== -1) {
          state.ingredients[index] = action.payload;
        } else {
          state.ingredients.push(action.payload);
        }
        state.lowStockAlerts = state.ingredients.filter((ing: any) => ing.stock <= ing.minStock).map((ing: any) => ing.id);
      })
      // deleteIngredient
      .addCase(deleteIngredient.fulfilled, (state, action) => {
        state.ingredients = state.ingredients.filter((i: any) => i.id !== action.payload);
      })
      // restockIngredient
      .addCase(restockIngredient.fulfilled, (state, action) => {
        const index = state.ingredients.findIndex((i: any) => i.id === action.payload.id);
        if (index !== -1) {
          state.ingredients[index] = action.payload;
        }
      })
      // adjustStock
      .addCase(adjustStock.fulfilled, (state, action) => {
        const index = state.ingredients.findIndex((i: any) => i.id === action.payload.id);
        if (index !== -1) {
          state.ingredients[index] = action.payload;
        }
      })
      // deductIngredientsForSale
      .addCase(deductIngredientsForSale.fulfilled, (state, action) => {
        // Actualizar stock de ingredientes si la respuesta incluye los ingredientes actualizados
        if (action.payload.ingredients) {
          action.payload.ingredients.forEach((updatedIng: any) => {
            const index = state.ingredients.findIndex((i: any) => i.id === updatedIng.id);
            if (index !== -1) {
              state.ingredients[index] = updatedIng;
            }
          });
        }
      });
  },
});

export const { setIngredients, setMovements, consumeIngredients } = inventorySlice.actions;
export default inventorySlice.reducer;
