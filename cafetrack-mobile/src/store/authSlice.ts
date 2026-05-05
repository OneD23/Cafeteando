import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.login(credentials);
      const token = response.token;
      const user = response.user;

      if (!token || !user) {
        throw new Error('Respuesta de autenticación inválida');
      }

      await AsyncStorage.setItem('token', token);
      return { user, token };
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Credenciales inválidas');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      AsyncStorage.removeItem('token');
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || action.error.message || 'Error de login';
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;  // ← DEFAULT EXPORTw
