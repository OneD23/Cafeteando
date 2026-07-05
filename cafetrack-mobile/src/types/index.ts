// Ingredientes/Crudos (café en grano, leche, azúcar, etc.)
export interface Ingredient {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'unidad' | 'oz';
  stock: number;
  minStock: number;
  costPerUnit: number;
  supplier?: string;
  lastRestocked?: Date;
}

// Receta/BOM - Cantidad de cada ingrediente para un producto
export interface RecipeItem {
  ingredientId: string;
  quantity: number; // en la unidad del ingrediente
}

// Receta completa de un producto
export interface Recipe {
  productId: string;
  items: RecipeItem[];
  preparationTime?: number; // minutos
  instructions?: string;
  image?: string;
}

// Producto terminado (lo que se vende)
export interface ProductOptionValue {
  label: string;
  priceDelta: number;
}

export interface ProductOptionGroup {
  name: string;
  required?: boolean;
  values: ProductOptionValue[];
}

export interface SelectedProductOption {
  groupName: string;
  valueLabel: string;
  priceDelta: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'coffee' | 'pastry' | 'drink' | 'food';
  icon: string;
  image?: string;
  isActive: boolean;
  hasRecipe: boolean; // true = se descuenta de inventario al vender
  recipeId?: string;
  options?: ProductOptionGroup[];
}

// Movimiento de inventario
export interface InventoryMovement {
  id: string;
  type: 'sale' | 'restock' | 'adjustment' | 'waste';
  ingredientId: string;
  quantity: number; // negativo para ventas/desperdicio, positivo para reposición
  date: Date;
  reason: string;
  saleId?: string;
  userId: string;
}
