import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { Ingredient, RecipeItem } from '../types';
import { addProduct, updateProduct, updateRecipe } from '../store/recipesSlice';

interface RecipeModalProps {
  visible: boolean;
  onClose: () => void;
  editingProduct?: any;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  visible,
  onClose,
  editingProduct,
}) => {
  const dispatch = useDispatch();
  const ingredients = useSelector((state: any) => state.inventory.ingredients);
  const recipes = useSelector((state: any) => state.recipes.recipes);
  const existingRecipe = useMemo(
    () => recipes.find((r: any) => r.productId === editingProduct?.id),
    [recipes, editingProduct]
  );
  
  const [name, setName] = useState(editingProduct?.name || '');
  const [price, setPrice] = useState(editingProduct?.price?.toString() || '');
  const [category, setCategory] = useState(editingProduct?.category || 'coffee');
  const [productImage, setProductImage] = useState(editingProduct?.image || '');
  const [selectedIngredients, setSelectedIngredients] = useState<RecipeItem[]>(existingRecipe?.items || []);
  const [prepTime, setPrepTime] = useState(existingRecipe?.preparationTime?.toString() || '2');

  const categories = [
    { id: 'coffee', name: 'Café', icon: '☕' },
    { id: 'pastry', name: 'Pastelería', icon: '🥐' },
    { id: 'drink', name: 'Bebida', icon: '🧊' },
    { id: 'food', name: 'Comida', icon: '🥪' },
  ];

  const toggleIngredient = (ingredient: Ingredient) => {
    const ingId = entityId(ingredient);
    const exists = selectedIngredients.find(i => String(i.ingredientId) === ingId);
    if (exists) {
      setSelectedIngredients(selectedIngredients.filter(i => String(i.ingredientId) !== ingId));
    } else {
      setSelectedIngredients([...selectedIngredients, { ingredientId: ingId, quantity: 0 }]);
    }
  };

  const updateQuantity = (ingredientId: string, qty: string) => {
    setSelectedIngredients(selectedIngredients.map(item => 
      item.ingredientId === ingredientId 
        ? { ...item, quantity: parseFloat(qty) || 0 }
        : item
    ));
  };

  const pickImageFromDevice = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('No disponible', 'En móvil nativo usa por ahora un link de imagen.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        setProductImage(result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => {
    if (!name || !price || selectedIngredients.length === 0) {
      Alert.alert('Error', 'Completa todos los campos y selecciona al menos un ingrediente');
      return;
    }

    const validItems = selectedIngredients.filter(i => i.quantity > 0);
    if (validItems.length === 0) {
      Alert.alert('Error', 'Las cantidades deben ser mayores a 0');
      return;
    }

    dispatch(addProduct({
      product: {
        name,
        price: parseFloat(price),
        category,
        icon: categories.find(c => c.id === category)?.icon || '☕',
        image: productImage || undefined,
        isActive: true,
        hasRecipe: true,
      },
      recipe: {
        items: validItems,
        preparationTime: parseInt(prepTime) || 2,
        image: recipeImage || undefined,
      },
    }));

    // Reset
    setName('');
    setPrice('');
    setProductImage('');
    setSelectedIngredients([]);
    onClose();
  };

  const calculateCost = () => {
    return selectedIngredients.reduce((total, item) => {
      const ing = ingredients.find((i: any) => entityId(i) === String(item.ingredientId));
      return total + (ing?.costPerUnit || 0) * item.quantity;
    }, 0);
  };

  const profitMargin = () => {
    const cost = calculateCost();
    const sellPrice = parseFloat(price) || 0;
    if (sellPrice === 0) return 0;
    return ((sellPrice - cost) / sellPrice * 100).toFixed(1);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editingProduct ? '✏️ Editar Receta' : '➕ Nueva Receta'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#f5f1e8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Nombre */}
            <Text style={styles.label}>Nombre del producto</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Cappuccino Especial"
              placeholderTextColor="#8b6f4e"
            />

            {/* Precio */}
            <Text style={styles.label}>Precio de venta ($)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#8b6f4e"
            />

            {/* Categoría */}
            <Text style={styles.label}>Categoría</Text>
            <View style={styles.categories}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, category === cat.id && styles.categoryActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryText, category === cat.id && styles.categoryTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Imagen del producto (opcional)</Text>
            <View style={styles.imageRow}>
              <TextInput
                style={[styles.input, styles.imageInput]}
                value={productImage}
                onChangeText={setProductImage}
                placeholder="https://.../producto.jpg"
                placeholderTextColor="#8b6f4e"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.uploadInlineBtn} onPress={pickImageFromDevice}>
                <Text style={styles.uploadInlineBtnText}>📷</Text>
              </TouchableOpacity>
            </View>

            {/* Tiempo de preparación */}
            <Text style={styles.label}>Tiempo de preparación (min)</Text>
            <TextInput
              style={styles.input}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="number-pad"
            />

            {/* Ingredientes */}
            <Text style={styles.label}>Ingredientes y gramaje</Text>
            {ingredients.map((ing: Ingredient) => (
              <View key={ing.id} style={styles.ingredientRow}>
                <TouchableOpacity 
                  style={styles.ingredientCheck}
                  onPress={() => toggleIngredient(ing)}
                >
                  <Ionicons 
                    name={selectedIngredients.find(i => String(i.ingredientId) === entityId(ing)) ? 'checkbox' : 'square-outline'} 
                    size={24} 
                    color="#d4a574" 
                  />
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    <Text style={styles.ingredientUnit}>Stock: {ing.stock} {ing.unit}</Text>
                  </View>
                </TouchableOpacity>
                
                {selectedIngredients.find(i => i.ingredientId === ing.id) && (
                  <View style={styles.qtyInputWrap}>
                    <TextInput
                      style={styles.qtyInput}
                      placeholder={`0 ${ing.unit}`}
                      placeholderTextColor="#8b6f4e"
                      keyboardType="decimal-pad"
                      value={(selectedIngredients.find(i => i.ingredientId === ing.id)?.quantity || '').toString()}
                      onChangeText={(text) => updateQuantity(ing.id, text)}
                    />
                    <Text style={styles.qtyUnitBadge}>{ing.unit}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* Resumen de costos */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>📊 Resumen</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Costo estimado:</Text>
                <Text style={styles.summaryValue}>${calculateCost().toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Precio venta:</Text>
                <Text style={styles.summaryValue}>${parseFloat(price || '0').toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Margen de ganancia:</Text>
                <Text style={[styles.summaryValue, { color: '#27ae60' }]}>{profitMargin()}%</Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>💾 Guardar Receta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a0f0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f5f1e8',
  },
  label: {
    color: '#d4a574',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#2c1810',
    borderRadius: 12,
    padding: 15,
    color: '#f5f1e8',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageInput: {
    flex: 1,
  },
  uploadInlineBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2c1810',
    borderWidth: 1,
    borderColor: '#4a3428',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInlineBtnText: {
    color: '#d4a574',
    fontSize: 20,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c1810',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  categoryActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryText: {
    color: '#8b6f4e',
    fontSize: 13,
  },
  categoryTextActive: {
    color: '#1a0f0a',
    fontWeight: '600',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2c1810',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  ingredientCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    color: '#f5f1e8',
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientUnit: {
    color: '#8b6f4e',
    fontSize: 12,
  },
  qtyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyInput: {
    width: 84,
    backgroundColor: '#1a0f0a',
    borderRadius: 8,
    padding: 8,
    color: '#f5f1e8',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#d4a574',
  },
  qtyUnitBadge: {
    color: '#d4a574',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    minWidth: 32,
    textAlign: 'right',
  },
  summary: {
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#d4a574',
  },
  summaryTitle: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#8b6f4e',
  },
  summaryValue: {
    color: '#f5f1e8',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  saveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
