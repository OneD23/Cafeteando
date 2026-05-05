import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from './authSlice';
import cartReducer from './cartSlice';
import inventoryReducer from './inventorySlice';
import recipesReducer from './recipesSlice';
import offlineReducer from './offlineSlice';
import { apiSlice } from './apiSlice';
import accountingReducer from './accountingSlice';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    cart: cartReducer,
    inventory: inventoryReducer,
    recipes: recipesReducer,
    offline: offlineReducer,
    accounting: accountingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }).concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
