import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getToken = async () => {
  return await AsyncStorage.getItem('token');
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api',
    prepareHeaders: async (headers: any) => {
      const token = await getToken();
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Product', 'Sale', 'Inventory'],
  endpoints: (builder: any) => ({
    login: builder.mutation({
      query: (credentials: any) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    getProducts: builder.query({
      query: () => '/products',
      providesTags: ['Product'],
    }),
    createSale: builder.mutation({
      query: (saleData: any) => ({
        url: '/sales',
        method: 'POST',
        body: saleData,
      }),
      invalidatesTags: ['Sale', 'Inventory'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetProductsQuery,
  useCreateSaleMutation,
} = apiSlice;
