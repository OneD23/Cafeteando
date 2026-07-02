import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../api/client';
import { Recipe, RecipeItem, Product } from '../types';


export const fetchProducts = createAsyncThunk(
  'recipes/fetchProducts',
  async () => {
    const response = await api.getProducts();
    return response.data;
  }
);

interface RecipesState {
  products: Product[];
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
}

const initialState: RecipesState = {
  products: [
    { id: 'prod-1', name: 'Espresso', price: 2.50, category: 'coffee', icon: '☕', isActive: true, hasRecipe: true, recipeId: 'rec-1' },
    { id: 'prod-2', name: 'Cappuccino', price: 3.50, category: 'coffee', icon: '☕', isActive: true, hasRecipe: true, recipeId: 'rec-2' },
    { id: 'prod-3', name: 'Latte', price: 3.75, category: 'coffee', icon: '☕', isActive: true, hasRecipe: true, recipeId: 'rec-3' },
    { id: 'prod-4', name: 'Americano', price: 2.75, category: 'coffee', icon: '☕', isActive: true, hasRecipe: true, recipeId: 'rec-4' },
    { id: 'prod-5', name: 'Mocha', price: 4.00, category: 'coffee', icon: '☕', isActive: true, hasRecipe: true, recipeId: 'rec-5' },
    { id: 'prod-6', name: 'Té Helado', price: 2.50, category: 'drink', icon: '🧊', isActive: true, hasRecipe: true, recipeId: 'rec-6' },
    { id: 'prod-7', name: 'Croissant', price: 2.75, category: 'pastry', icon: '🥐', isActive: true, hasRecipe: true, recipeId: 'rec-7' },
    { id: 'prod-8', name: 'Sandwich', price: 5.50, category: 'food', icon: '🥪', isActive: true, hasRecipe: true, recipeId: 'rec-8' },
  ],
  recipes: [
    // Espresso: 18g café, 30ml agua
    {
      productId: 'prod-1',
      items: [
        { ingredientId: 'ing-1', quantity: 18 },
        { ingredientId: 'ing-4', quantity: 30 },
      ],
      preparationTime: 2,
    },
    // Cappuccino: 18g café, 60ml leche, 60ml espuma
    {
      productId: 'prod-2',
      items: [
        { ingredientId: 'ing-1', quantity: 18 },
        { ingredientId: 'ing-2', quantity: 60 },
        { ingredientId: 'ing-5', quantity: 60 },
      ],
      preparationTime: 4,
    },
    // Latte: 18g café, 240ml leche, 30ml espuma
    {
      productId: 'prod-3',
      items: [
        { ingredientId: 'ing-1', quantity: 18 },
        { ingredientId: 'ing-2', quantity: 240 },
        { ingredientId: 'ing-5', quantity: 30 },
      ],
      preparationTime: 4,
    },
    // Americano: 18g café, 240ml agua
    {
      productId: 'prod-4',
      items: [
        { ingredientId: 'ing-1', quantity: 18 },
        { ingredientId: 'ing-4', quantity: 240 },
      ],
      preparationTime: 2,
    },
    // Mocha: 18g café, 200ml leche, 15g chocolate
    {
      productId: 'prod-5',
      items: [
        { ingredientId: 'ing-1', quantity: 18 },
        { ingredientId: 'ing-2', quantity: 200 },
        { ingredientId: 'ing-8', quantity: 15 },
      ],
      preparationTime: 5,
    },
    // Té Helado: 5g té, 200ml agua, 100g hielo
    {
      productId: 'prod-6',
      items: [
        { ingredientId: 'ing-10', quantity: 5 },
        { ingredientId: 'ing-4', quantity: 200 },
        { ingredientId: 'ing-11', quantity: 100 },
      ],
      preparationTime: 3,
    },
    // Croissant: 1 unidad masa, 50g mantequilla
    {
      productId: 'prod-7',
      items: [
        { ingredientId: 'ing-6', quantity: 1 },
        { ingredientId: 'ing-7', quantity: 50 },
      ],
      preparationTime: 0, // Ya preparado
    },
    // Sandwich: 1 pan, 100g jamón, 50g queso, 30g lechuga, 40g tomate
    {
      productId: 'prod-8',
      items: [
        { ingredientId: 'ing-12', quantity: 1 },
        { ingredientId: 'ing-13', quantity: 100 },
        { ingredientId: 'ing-14', quantity: 50 },
        { ingredientId: 'ing-15', quantity: 30 },
        { ingredientId: 'ing-16', quantity: 40 },
      ],
      preparationTime: 5,
    },
  ],
  loading: false,
  error: null,
};

const getEntityId = (entity: any) => String(entity?.id ?? entity?._id ?? '');

const recipesSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {
    // Añadir nuevo producto con receta
    addProduct: (state, action: PayloadAction<{
      product: Partial<Product> & Omit<Product, 'id' | 'recipeId'>;
      recipe: Partial<Recipe> & Omit<Recipe, 'productId'>;
    }>) => {
      const productId = getEntityId(action.payload.product) || `prod-${Date.now()}`;
      const recipeId = getEntityId(action.payload.product.recipeId) || String(action.payload.product.recipeId ?? `rec-${Date.now()}`);
      
      const newProduct: Product = {
        ...action.payload.product,
        id: productId,
        recipeId: recipeId,
        hasRecipe: true,
      } as Product;
      
      const newRecipe: Recipe = {
        ...action.payload.recipe,
        productId,
      };
      
      state.products.push(newProduct);
      state.recipes.push(newRecipe);
    },
    
    // Actualizar producto
    updateProduct: (state, action: PayloadAction<Partial<Product> & { id: string }>) => {
      const index = state.products.findIndex((p: any) => getEntityId(p) === String(action.payload.id));
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...action.payload };
      }
    },
    
    // Eliminar producto y su receta
    deleteProduct: (state, action: PayloadAction<string>) => {
      const product = state.products.find((p: any) => getEntityId(p) === String(action.payload));
      if (product) {
        const targetId = getEntityId(product);
        state.products = state.products.filter((p: any) => getEntityId(p) !== targetId);
        state.recipes = state.recipes.filter((r: any) => String(r.productId) !== targetId);
      }
    },
    
    // Actualizar receta
    updateRecipe: (state, action: PayloadAction<{
      productId: string;
      items: RecipeItem[];
      preparationTime?: number;
      instructions?: string;
    }>) => {
      const index = state.recipes.findIndex(r => String(r.productId) === String(action.payload.productId));
      if (index !== -1) {
        state.recipes[index] = { ...state.recipes[index], ...action.payload };
      } else {
        state.recipes.push(action.payload);
      }
    },
    
    // Toggle producto activo/inactivo
    toggleProductActive: (state, action: PayloadAction<string>) => {
      const product = state.products.find((p: any) => getEntityId(p) === String(action.payload));
      if (product) {
        product.isActive = !product.isActive;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        const products = (action.payload || []).map((p: any) => ({
          ...p,
          id: String(p.id ?? p._id),
          recipeId: typeof p.recipeId === 'object' ? String(p.recipeId.id ?? p.recipeId._id) : String(p.recipeId ?? ''),
        }));

        const recipes = (action.payload || [])
          .map((p: any) => {
            const recipe = p.recipeId;
            if (!recipe || typeof recipe !== 'object') return null;
            return {
              ...recipe,
              productId: String(p.id ?? p._id),
            };
          })
          .filter(Boolean);

        state.products = products;
        state.recipes = recipes as Recipe[];
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'No se pudieron cargar productos';
      });
  },
});

export const {
  addProduct,
  updateProduct,
  deleteProduct,
  updateRecipe,
  toggleProductActive,
} = recipesSlice.actions;

export default recipesSlice.reducer;