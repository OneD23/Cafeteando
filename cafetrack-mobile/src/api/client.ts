import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

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
  async me() {
    return this.request('/auth/me');
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

  async updateIngredient(id: string, ingredient: any) {
    return this.request(`/ingredients/${id}`, {
      method: 'PUT',
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

  async updateProduct(id: string, product: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }


  async sendPromotion(payload: {
    client: { name: string; phone?: string; email?: string };
    message: string;
  }) {
    return this.request('/clients/promotions/send', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  async getCashSession() {
    const response = await this.request('/accounting/cash/current');
    return {
      ...response,
      data: response?.data
        ? { ...response.data, isOpen: true }
        : { isOpen: false, openedAt: null, openingAmount: 0 },
    };
  }

  async openCashSession(openingAmount: number) {
    return this.request('/accounting/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingAmount }),
    });
  }

  async closeCashSession(countedCash = 0, observations = '') {
    return this.request('/accounting/cash/close', {
      method: 'POST',
      body: JSON.stringify({ countedCash, observations }),
    });
  }

  async generateDgiiEcf(payload: { saleId: string; rnc?: string; razonSocial?: string; ncfType?: string }) {
    return this.request('/fiscal/dgii/ecf/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendDgiiEcf(ecf: any) {
    return this.request('/fiscal/dgii/ecf/send', {
      method: 'POST',
      body: JSON.stringify({ ecf }),
    });
  }

  async getAccountingEntries(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/entries${queryString}`);
  }

  async createAccountingEntry(payload: {
    direction: 'in' | 'out';
    category: 'sale' | 'cogs' | 'expense' | 'adjustment' | 'other';
    description: string;
    amount: number;
    date?: string;
    reference?: string;
  }) {
    return this.request('/accounting/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getDailyJournal(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/daily-journal${queryString}`);
  }

  async getInvoices(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/invoices${queryString}`);
  }
  async getAccountingDashboard(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/dashboard${queryString}`);
  }

  async getAccountingJournal(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/journal${queryString}`);
  }

  async getCashMovements(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/movements${queryString}`);
  }

  async createExpense(payload: any) {
    return this.request('/accounting/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async openAccountingCash(openingAmount: number) {
    return this.request('/accounting/cash/open', {
      method: 'POST',
      body: JSON.stringify({ openingAmount }),
    });
  }

  async closeAccountingCash(payload: { countedCash: number; observations?: string }) {
    return this.request('/accounting/cash/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getCurrentCash() {
    return this.request('/accounting/cash/current');
  }

  async getCashClosings(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/accounting/cash/closings${queryString}`);
  }

  async voidInvoice(id: string, reason: string) {
    return this.request(`/accounting/invoices/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getReport(type: 'daily' | 'weekly' | 'monthly' | 'range' | 'expenses' | 'products' | 'inventory' | 'cash', params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports/${type}${queryString}`);
  }

}

export const api = new ApiClient(API_URL);
export default api;
