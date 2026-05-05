import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
// Para producción: 'https://tu-api-render.com/api'

const mapIds = (payload: any): any => {
  if (Array.isArray(payload)) {
    return payload.map(mapIds);
  }

  if (payload && typeof payload === 'object') {
    const mapped: Record<string, any> = {};

    Object.keys(payload).forEach((key) => {
      mapped[key] = mapIds(payload[key]);
    });

    if (mapped._id && !mapped.id) {
      mapped.id = mapped._id;
    }

    return mapped;
  }

  return payload;
};

class ApiClient {
  private baseUrl: string;
  private socket: any;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('token');
  }

  private async request(endpoint: string, options: any = {}) {
    const token = await this.getToken();
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = mapIds(await response.json());

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth
  async login(credentials: { username: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async bootstrapAdmin(payload: {
    username: string;
    email: string;
    password: string;
    name: string;
  }) {
    return this.request('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async registerUser(payload: {
    username: string;
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'manager' | 'cashier';
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Ingredients
  async getIngredients() {
    return this.request('/ingredients');
  }

  async createIngredient(ingredient: any) {
    return this.request('/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient),
    });
  }

  async restockIngredient(id: string, quantity: number, reason?: string) {
    return this.request(`/ingredients/${id}/restock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, reason }),
    });
  }
  async deleteIngredient(id: string) {
  return this.request(`/ingredients/${id}`, {
    method: 'DELETE',
  });
}

async adjustStock(id: string, newStock: number, reason: string) {
  return this.request(`/ingredients/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ newStock, reason }),
  });
}

async deductIngredients(recipeId: string, quantity: number, saleId: string) {
  return this.request('/ingredients/deduct', {
    method: 'POST',
    body: JSON.stringify({ recipeId, quantity, saleId }),
  });
}

  // Products
  async getProducts() {
    return this.request('/products');
  }

  async createProduct(product: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  // Sales
  async createSale(saleData: any) {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async getSales(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/sales${queryString}`);
  }

  async getDashboardStats() {
    return this.request('/sales/dashboard/stats');
  }
}

export const api = new ApiClient(API_URL);
export default api;
