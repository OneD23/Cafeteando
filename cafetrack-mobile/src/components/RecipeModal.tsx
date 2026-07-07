import React, { useEffect, useMemo, useState } from 'react';
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
import { Ingredient, ProductOptionGroup, RecipeItem } from '../types';
import { addProduct, updateProduct, updateRecipe } from '../store/recipesSlice';
import { api } from '../api/client';

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
  const entityId = (entity: any): string => String(entity?.id ?? entity?._id ?? '');

  const ingredients = useSelector((state: any) => state.inventory.ingredients);
  const recipes = useSelector((state: any) => state.recipes.recipes);
  const editingProductId = entityId(editingProduct);
  const existingRecipe = useMemo(
    () => recipes.find((r: any) => String(r.productId) === editingProductId),
    [recipes, editingProductId]
  );

  const [name, setName] = useState(editingProduct?.name || '');
  const [price, setPrice] = useState(editingProduct?.price?.toString() || '');
  const [category, setCategory] = useState(editingProduct?.category || 'coffee');
  const [productImage, setProductImage] = useState(editingProduct?.image || '');
  const [selectedIngredients, setSelectedIngredients] = useState<RecipeItem[]>(existingRecipe?.items || []);
  const [prepTime, setPrepTime] = useState(existingRecipe?.preparationTime?.toString() || '2');
  const [options, setOptions] = useState<ProductOptionGroup[]>(editingProduct?.options || []);

  useEffect(() => {
    if (!visible) return;

    setName(editingProduct?.name || '');
    setPrice(editingProduct?.price?.toString() || '');
    setCategory(editingProduct?.category || 'coffee');
    setProductImage(editingProduct?.image || '');
    setSelectedIngredients(existingRecipe?.items || []);
    setPrepTime(existingRecipe?.preparationTime?.toString() || '2');
    setOptions(editingProduct?.options || []);
  }, [visible, editingProduct, existingRecipe]);

  const categories = [
    { id: 'coffee', name: 'Café', icon: '☕' },
    { id: 'pastry', name: 'Pastelería', icon: '🥐' },
    { id: 'drink', name: 'Bebida', icon: '🧊' },
    { id: 'food', name: 'Comida', icon: '🥪' },
  ];


  const selectedIngredientId = (item: RecipeItem) => {
    const ingredientRef = item?.ingredientId ?? (item as any)?.ingredient;
    return typeof ingredientRef === 'object' ? entityId(ingredientRef) : String(ingredientRef ?? '');
  };

  const toggleIngredient = (ingredient: Ingredient) => {
    const ingId = entityId(ingredient);
    const exists = selectedIngredients.find(i => selectedIngredientId(i) === ingId);
    if (exists) {
      setSelectedIngredients(selectedIngredients.filter(i => selectedIngredientId(i) !== ingId));
    } else {
      setSelectedIngredients([...selectedIngredients, { ingredientId: ingId, quantity: 0 }]);
    }
  };

  const updateQuantity = (ingredientId: string, qty: string) => {
    setSelectedIngredients(selectedIngredients.map(item =>
      selectedIngredientId(item) === ingredientId
        ? { ingredientId, quantity: parseFloat(qty) || 0 }
        : item
    ));
  };

  const updateOptionGroup = (index: number, patch: Partial<ProductOptionGroup>) => {
    setOptions((prev) => prev.map((group, groupIndex) => groupIndex === index ? { ...group, ...patch } : group));
  };

  const updateOptionValue = (groupIndex: number, valueIndex: number, patch: { label?: string; priceDelta?: number }) => {
    setOptions((prev) => prev.map((group, currentGroupIndex) => {
      if (currentGroupIndex !== groupIndex) return group;
      return {
        ...group,
        values: group.values.map((value, currentValueIndex) => currentValueIndex === valueIndex ? { ...value, ...patch } : value),
      };
    }));
  };

  const addOptionGroup = () => {
    setOptions((prev) => [...prev, { name: '', required: false, values: [{ label: '', priceDelta: 0 }] }]);
  };

  const removeOptionGroup = (index: number) => {
    setOptions((prev) => prev.filter((_, groupIndex) => groupIndex !== index));
  };

  const addOptionValue = (groupIndex: number) => {
    setOptions((prev) => prev.map((group, currentGroupIndex) => currentGroupIndex === groupIndex
      ? { ...group, values: [...group.values, { label: '', priceDelta: 0 }] }
      : group));
  };

  const removeOptionValue = (groupIndex: number, valueIndex: number) => {
    setOptions((prev) => prev.map((group, currentGroupIndex) => currentGroupIndex === groupIndex
      ? { ...group, values: group.values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex) }
      : group));
  };

  const normalizeOptions = () => options
    .map((group) => ({
      ...group,
      name: group.name.trim(),
      values: group.values
        .map((value) => ({ label: value.label.trim(), priceDelta: Number(value.priceDelta || 0) }))
        .filter((value) => value.label),
    }))
    .filter((group) => group.name && group.values.length > 0);

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

  const handleSave = async () => {
    if (!name || !price || selectedIngredients.length === 0) {
      Alert.alert('Error', 'Completa todos los campos y selecciona al menos un ingrediente');
      return;
    }

    const validItems = selectedIngredients
      .map((i) => ({ ingredientId: selectedIngredientId(i), quantity: Number(i.quantity || 0) }))
      .filter((i) => i.ingredientId && i.quantity > 0);
    if (validItems.length === 0) {
      Alert.alert('Error', 'Las cantidades deben ser mayores a 0');
      return;
    }

    const productPayload = {
      name,
      price: parseFloat(price),
      category,
      icon: categories.find(c => c.id === category)?.icon || '☕',
      image: productImage || undefined,
      isActive: editingProduct?.isActive ?? true,
      hasRecipe: true,
      options: normalizeOptions(),
    };

    const recipePayload = {
      items: validItems,
      preparationTime: parseInt(prepTime) || 2,
      image: productImage || undefined,
    };

    const localProductId = editingProductId || `prod-${Date.now()}`;

    if (editingProductId) {
      dispatch(updateProduct({ id: editingProductId, ...productPayload }));
      dispatch(updateRecipe({ productId: editingProductId, ...recipePayload }));
    } else {
      dispatch(addProduct({
        product: { ...productPayload, id: localProductId, recipeId: `rec-${Date.now()}` },
        recipe: { ...recipePayload, productId: localProductId },
      }));
    }

    try {
      if (editingProductId) {
        const response = await api.updateProduct(editingProductId, {
          ...productPayload,
          recipe: recipePayload,
        });
        const savedProduct = response?.data;
        const savedRecipe = savedProduct?.recipeId && typeof savedProduct.recipeId === 'object'
          ? savedProduct.recipeId
          : recipePayload;

        dispatch(updateProduct({ id: editingProductId, ...productPayload, ...(savedProduct || {}) }));
        dispatch(updateRecipe({ productId: editingProductId, ...savedRecipe, ...recipePayload }));
      } else {
        const response = await api.createProduct({
          ...productPayload,
          recipe: recipePayload,
        });
        const savedProduct = response?.data;
        const savedProductId = entityId(savedProduct);
        const savedRecipe = savedProduct?.recipeId && typeof savedProduct.recipeId === 'object'
          ? savedProduct.recipeId
          : recipePayload;

        if (savedProduct && savedProductId && savedProductId !== localProductId) {
          dispatch(updateProduct({ id: localProductId, ...savedProduct }));
          dispatch(updateRecipe({ productId: savedProductId, ...savedRecipe, ...recipePayload }));
        }
      }
    } catch (error: any) {
      console.warn('Receta guardada localmente; sincronización pendiente:', error?.message || error);
    }

    // Reset
    setName('');
    setPrice('');
    setProductImage('');
    setSelectedIngredients([]);
    setOptions([]);
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
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

            <Text style={styles.label}>Opciones extra del producto</Text>
            <Text style={styles.helperText}>Agrega tamaños, sabores o extras con precio adicional. Ej: Tamaño → 12, 16 y 20 onzas.</Text>
            {options.map((group, groupIndex) => (
              <View key={`option-group-${groupIndex}`} style={styles.optionGroupCard}>
                <View style={styles.optionHeaderRow}>
                  <TextInput
                    style={[styles.input, styles.optionGroupInput]}
                    value={group.name}
                    onChangeText={(text) => updateOptionGroup(groupIndex, { name: text })}
                    placeholder="Nombre: Tamaño, Extras..."
                    placeholderTextColor="#8b6f4e"
                  />
                  <TouchableOpacity style={styles.removeOptionBtn} onPress={() => removeOptionGroup(groupIndex)}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.requiredRow}
                  onPress={() => updateOptionGroup(groupIndex, { required: !group.required })}
                >
                  <Ionicons name={group.required ? 'checkbox' : 'square-outline'} size={22} color="#d4a574" />
                  <Text style={styles.requiredText}>Obligatorio para vender</Text>
                </TouchableOpacity>
                {group.values.map((value, valueIndex) => (
                  <View key={`option-value-${groupIndex}-${valueIndex}`} style={styles.optionValueRow}>
                    <TextInput
                      style={[styles.input, styles.optionValueName]}
                      value={value.label}
                      onChangeText={(text) => updateOptionValue(groupIndex, valueIndex, { label: text })}
                      placeholder="Ej: 16 onzas"
                      placeholderTextColor="#8b6f4e"
                    />
                    <TextInput
                      style={[styles.input, styles.optionValuePrice]}
                      value={String(value.priceDelta || '')}
                      onChangeText={(text) => updateOptionValue(groupIndex, valueIndex, { priceDelta: parseFloat(text) || 0 })}
                      keyboardType="decimal-pad"
                      placeholder="+$"
                      placeholderTextColor="#8b6f4e"
                    />
                    <TouchableOpacity style={styles.removeSmallBtn} onPress={() => removeOptionValue(groupIndex, valueIndex)}>
                      <Ionicons name="close" size={16} color="#f5f1e8" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addOptionValueBtn} onPress={() => addOptionValue(groupIndex)}>
                  <Text style={styles.addOptionText}>+ Agregar opción</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addOptionGroupBtn} onPress={addOptionGroup}>
              <Text style={styles.addOptionText}>+ Agregar grupo de opciones</Text>
            </TouchableOpacity>

            {/* Ingredientes */}
            <Text style={styles.label}>Ingredientes y gramaje</Text>
            {ingredients.map((ing: Ingredient) => (
              <View key={entityId(ing)} style={styles.ingredientRow}>
                <TouchableOpacity
                  style={styles.ingredientCheck}
                  onPress={() => toggleIngredient(ing)}
                >
                  <Ionicons
                    name={selectedIngredients.find(i => selectedIngredientId(i) === entityId(ing)) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color="#d4a574"
                  />
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    <Text style={styles.ingredientUnit}>Stock: {ing.stock} {ing.unit}</Text>
                  </View>
                </TouchableOpacity>

                {selectedIngredients.find(i => selectedIngredientId(i) === entityId(ing)) && (
                  <View style={styles.qtyInputWrap}>
                    <TextInput
                      style={styles.qtyInput}
                      placeholder={`0 ${ing.unit}`}
                      placeholderTextColor="#8b6f4e"
                      keyboardType="decimal-pad"
                      value={(selectedIngredients.find(i => selectedIngredientId(i) === entityId(ing))?.quantity || '').toString()}
                      onChangeText={(text) => updateQuantity(entityId(ing), text)}
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
  scrollContent: {
    paddingBottom: 16,
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

  helperText: {
    color: '#8b6f4e',
    fontSize: 12,
    marginBottom: 10,
  },
  optionGroupCard: {
    backgroundColor: '#2c1810',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a3428',
    padding: 10,
    marginBottom: 10,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  optionGroupInput: {
    flex: 1,
  },
  removeOptionBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#c0392b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  requiredText: {
    color: '#f5f1e8',
    fontSize: 13,
  },
  optionValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionValueName: {
    flex: 1,
    padding: 10,
  },
  optionValuePrice: {
    width: 86,
    padding: 10,
  },
  removeSmallBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#4a3428',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionGroupBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d4a574',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  addOptionValueBtn: {
    padding: 10,
    alignItems: 'center',
  },
  addOptionText: {
    color: '#d4a574',
    fontWeight: '700',
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
