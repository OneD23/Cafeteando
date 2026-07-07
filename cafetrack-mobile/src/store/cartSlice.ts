import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { consumeIngredients } from './inventorySlice';
import { recordSale } from './accountingSlice';
import { queueUnsynced } from '../services/localDb';
import api from '../api/client';

const entityId = (entity: any) => String(entity?.id ?? entity?._id ?? '');

const recipeIngredientId = (recipeItem: any) => {
  const ingredientRef = recipeItem?.ingredientId ?? recipeItem?.ingredient;
  return typeof ingredientRef === 'object' ? entityId(ingredientRef) : String(ingredientRef ?? '');
};

export interface CartItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  icon: string;
  stock: number;
  hasRecipe: boolean;
  recipeId?: string;
  allowIncompleteRecipe?: boolean;
  basePrice?: number;
  selectedOptions?: Array<{ groupName: string; valueLabel: string; priceDelta: number }>;
  cartKey?: string;
}

interface CartState {
  items: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  processingSale: boolean;
  taxEnabled: boolean;
}

const initialState: CartState = {
  items: [],
  totals: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  },
  processingSale: false,
  taxEnabled: true,
};


const addSaleToLocalCashSession = async (paymentMethod: string, total: number) => {
  const raw = await AsyncStorage.getItem('cafetrack_cash_session');
  if (!raw) return;
  const session = JSON.parse(raw);
  if (!session?.isOpen) return;

  const summary = session.summary || { expectedCash: Number(session.openingAmount || 0), totals: { sales: 0 }, paymentMethods: [] };
  const paymentMethods = Array.isArray(summary.paymentMethods) ? [...summary.paymentMethods] : [];
  const methodIndex = paymentMethods.findIndex((row: any) => row.method === paymentMethod);
  if (methodIndex >= 0) {
    paymentMethods[methodIndex] = {
      ...paymentMethods[methodIndex],
      total: Number(paymentMethods[methodIndex].total || 0) + total,
    };
  } else {
    paymentMethods.push({ method: paymentMethod, total });
  }

  const expectedCash = Number(summary.expectedCash || session.openingAmount || 0) + (paymentMethod === 'cash' ? total : 0);
  await AsyncStorage.setItem('cafetrack_cash_session', JSON.stringify({
    ...session,
    summary: {
      ...summary,
      expectedCash,
      totals: { ...(summary.totals || {}), sales: Number(summary.totals?.sales || 0) + total },
      paymentMethods,
    },
  }));
};

const calculateTotals = (items: CartItem[], discount = 0, taxEnabled = true) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const sanitizedDiscount = Math.min(Math.max(discount, 0), subtotal);
  const taxableBase = Math.max(subtotal - sanitizedDiscount, 0);
  const tax = taxEnabled ? taxableBase * 0.16 : 0;
  return {
    subtotal,
    discount: sanitizedDiscount,
    tax,
    total: taxableBase + tax,
  };
};

// Thunk para procesar venta con descuento de inventario
export const processSale = createAsyncThunk(
  'cart/processSale',
  async (payload: { paymentMethod: string; customerName?: string; discount?: number }, { getState, dispatch }) => {
    const state = getState() as {
      cart: CartState;
      recipes: { recipes: Array<{ productId: string; items: Array<{ ingredientId: string | any; ingredient?: string | any; quantity: number }> }> };
      inventory: { ingredients: Array<{ id: string; _id?: string; stock: number; name: string; costPerUnit?: number }> };
    };
    const { items, taxEnabled } = state.cart;
    const discountAmount = Math.max(Number(payload.discount || 0), 0);
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const sanitizedDiscount = Math.min(discountAmount, subtotal);
    const taxableBase = Math.max(subtotal - sanitizedDiscount, 0);
    const saleTotal = taxableBase + (taxEnabled ? taxableBase * 0.16 : 0);
    const saleId = `SALE-${Date.now()}`;
    let totalCost = 0;
    
    // Verificar stock de ingredientes para todos los items
    for (const item of items) {
      if (item.hasRecipe) {
        const recipe = state.recipes.recipes.find((r) => String(r.productId) === entityId(item));
        if (!recipe) continue;

        for (const recipeItem of recipe.items) {
          const ingredientId = recipeIngredientId(recipeItem);
          if (!ingredientId || recipeItem.quantity <= 0) continue;

          const ingredient = state.inventory.ingredients.find((ing) => entityId(ing) === ingredientId);
          const needed = recipeItem.quantity * item.quantity;

          if (!ingredient) continue;

          if (ingredient.stock < needed) {
            if (item.allowIncompleteRecipe) continue;
            throw new Error(`No hay suficiente stock para: ${item.name}`);
          }

          totalCost += (ingredient.costPerUnit || 0) * needed;
        }

        dispatch(consumeIngredients({
          recipeItems: recipe.items
            .map((recipeItem) => ({ ...recipeItem, ingredientId: recipeIngredientId(recipeItem) }))
            .filter((recipeItem) => recipeItem.ingredientId && recipeItem.quantity > 0),
          quantity: item.quantity,
          saleId,
          productName: item.name,
        }));
      }
    }

    dispatch(recordSale({
      saleId,
      revenue: saleTotal,
      cogs: totalCost,
    }));
    const salePayload = {
      items: items.map((i) => ({
        productId: i.id,
        quantity: i.quantity,
        price: i.price,
        basePrice: i.basePrice ?? i.price,
        selectedOptions: i.selectedOptions || [],
      })),
      paymentMethod: payload.paymentMethod,
      customer: payload.customerName ? { name: payload.customerName } : undefined,
      discount: sanitizedDiscount > 0 ? { type: 'fixed', value: sanitizedDiscount } : { type: 'none', value: 0 },
      total: saleTotal,
      taxEnabled,
      unsynced: true,
      localSaleId: saleId,
      syncId: saleId,
      idempotencyKey: saleId,
    };

    await addSaleToLocalCashSession(payload.paymentMethod, saleTotal);

    let synced = false;
    try {
      await api.createSale(salePayload);
      synced = true;
    } catch (error: any) {
      if (error?.status) {
        throw error;
      }
      await queueUnsynced('sale', salePayload);
    }
    
    return { success: true, timestamp: new Date().toISOString(), saleId, synced };
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<any>) => {
      const productId = entityId(action.payload);
      const cartKey = action.payload.cartKey || productId;
      const existing = state.items.find((item: any) => (item.cartKey || entityId(item)) === cartKey);
      if (existing) {
        if (existing.allowIncompleteRecipe || existing.quantity < existing.stock) {
          existing.quantity += 1;
        }
      } else {
        state.items.push({ ...action.payload, id: productId, cartKey, quantity: 1 });
      }
      state.totals = calculateTotals(state.items, state.totals.discount, state.taxEnabled);
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item: any) => (item.cartKey || item.id) !== action.payload);
      state.totals = calculateTotals(state.items, state.totals.discount, state.taxEnabled);
    },
    updateQuantity: (state, action: PayloadAction<{ id: string; qty: number }>) => {
      const item = state.items.find((item: any) => (item.cartKey || item.id) === action.payload.id);
      if (item) {
        item.quantity = Math.max(1, Math.min(action.payload.qty, item.stock));
      }
      state.totals = calculateTotals(state.items, state.totals.discount, state.taxEnabled);
    },
    clearCart: (state) => {
      state.items = [];
      state.totals = { subtotal: 0, discount: 0, tax: 0, total: 0 };
    },

    setTaxEnabled: (state, action: PayloadAction<boolean>) => {
      state.taxEnabled = action.payload;
      state.totals = calculateTotals(state.items, state.totals.discount, state.taxEnabled);
    },
    setDiscount: (state, action: PayloadAction<{ type: 'percentage' | 'fixed'; value: number }>) => {
      const { type, value } = action.payload;
      let discount = 0;
      if (type === 'percentage') {
        discount = state.totals.subtotal * (value / 100);
      } else {
        discount = Math.min(value, state.totals.subtotal);
      }
      state.totals = calculateTotals(state.items, discount, state.taxEnabled);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(processSale.pending, (state) => {
        state.processingSale = true;
      })
      .addCase(processSale.fulfilled, (state) => {
        state.processingSale = false;
        state.items = [];
        state.totals = { subtotal: 0, discount: 0, tax: 0, total: 0 };
      })
      .addCase(processSale.rejected, (state) => {
        state.processingSale = false;
      });
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, setDiscount, setTaxEnabled } = cartSlice.actions;
export default cartSlice.reducer;
