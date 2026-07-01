import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
    Alert,
  TextInput,
  Modal,
  Image,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import type { AppDispatch } from '../store';
import { RecipeModal } from '../components/RecipeModal';
import {
  addIngredient,
  updateIngredient,
  deleteIngredient,
  restockIngredient,
  adjustStock,
} from '../store/inventorySlice';
import { deleteProduct, toggleProductActive } from '../store/recipesSlice';
import { addJournalEntry } from '../store/accountingSlice';

export const InventoryScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const { ingredients, lowStockAlerts } = useSelector((state: any) => state.inventory);
  const { products, recipes } = useSelector((state: any) => state.recipes);
  
  const [activeTab, setActiveTab] = useState<'ingredients' | 'products'>('ingredients');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Formulario de ingrediente
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('g');
  const [ingStock, setIngStock] = useState('');
  const [ingMinStock, setIngMinStock] = useState('');
  const [ingTotalCost, setIngTotalCost] = useState('');
  const [ingPackageCount, setIngPackageCount] = useState('');
  const [ingQuantityPerPackage, setIngQuantityPerPackage] = useState('');
  const [ingComponents, setIngComponents] = useState<Array<{ ingredientId: string; quantity: string }>>([]);

  const units = ['g', 'ml', 'unidad', 'oz'];

  const bulkPurchaseStock = useMemo(() => {
    const packageCount = parseFloat(ingPackageCount);
    const quantityPerPackage = parseFloat(ingQuantityPerPackage);

    if (!Number.isFinite(packageCount) || packageCount <= 0 || !Number.isFinite(quantityPerPackage) || quantityPerPackage <= 0) {
      return 0;
    }

    return packageCount * quantityPerPackage;
  }, [ingPackageCount, ingQuantityPerPackage]);

  const calculatedUnitCost = useMemo(() => {
    const stock = parseFloat(ingStock);
    const totalCost = parseFloat(ingTotalCost);

    if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      return 0;
    }

    return totalCost / stock;
  }, [ingStock, ingTotalCost]);

  const entityId = (entity: any): string => String(entity?.id ?? entity?._id ?? '');

  const requestNumericInput = (
    title: string,
    message: string,
    onConfirm: (value: number) => void
  ) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.prompt(message, '0');
      if (raw === null) return;
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) {
        Alert.alert('Valor inválido', 'Ingresa un número válido.');
        return;
      }
      onConfirm(parsed);
      return;
    }

    Alert.prompt(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: (value?: string) => {
            const parsed = parseFloat(value || '0');
            if (isNaN(parsed)) {
              Alert.alert('Valor inválido', 'Ingresa un número válido.');
              return;
            }
            onConfirm(parsed);
          },
        },
      ],
      'plain-text'
    );
  };

  const resetIngredientForm = () => {
    setIngName('');
    setIngUnit('g');
    setIngStock('');
    setIngMinStock('');
    setIngTotalCost('');
    setIngPackageCount('');
    setIngQuantityPerPackage('');
    setIngComponents([]);
    setEditingIngredient(null);
  };

  const handleSaveIngredient = () => {
    if (!ingName || !ingStock || !ingMinStock || !ingTotalCost) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    const stockQuantity = parseFloat(ingStock);
    const totalCost = parseFloat(ingTotalCost);

    if (!Number.isFinite(stockQuantity) || stockQuantity <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa una cantidad mayor a 0 para calcular el costo unitario.');
      return;
    }

    if (!Number.isFinite(totalCost) || totalCost < 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio total válido.');
      return;
    }

    const components = ingComponents
      .filter((component) => component.ingredientId && parseFloat(component.quantity) > 0)
      .map((component) => ({ ingredientId: component.ingredientId, quantity: parseFloat(component.quantity) }));

    const repeatedComponent = components.find((component, index) =>
      components.findIndex((candidate) => candidate.ingredientId === component.ingredientId) !== index
    );
    if (repeatedComponent) {
      Alert.alert('Composición duplicada', 'No repitas el mismo ingrediente dentro de la composición.');
      return;
    }

    const editingId = editingIngredient ? entityId(editingIngredient) : '';
    if (editingId && components.some((component) => component.ingredientId === editingId)) {
      Alert.alert('Composición inválida', 'Un ingrediente no puede estar compuesto por sí mismo.');
      return;
    }

    const payload = {
      name: ingName,
      unit: ingUnit as any,
      stock: stockQuantity,
      minStock: parseFloat(ingMinStock),
      costPerUnit: calculatedUnitCost,
      components,
    };

    if (editingIngredient) {
      dispatch(updateIngredient({ ...editingIngredient, ...payload, id: entityId(editingIngredient) }) as any);
      Alert.alert('Actualizado', `${ingName} fue actualizado correctamente.`);
    } else {
      dispatch(addIngredient(payload) as any);
      dispatch(addJournalEntry({
        direction: 'in',
        category: 'inventory',
        description: `Alta ingrediente: ${ingName}`,
        amount: totalCost,
      }));
    }

    resetIngredientForm();
    setShowIngredientModal(false);
  };

  const handleRestock = (ingredient: any) => {
    requestNumericInput('Reposición', `Cantidad a añadir a ${ingredient.name}:`, (qty) => {
      if (qty <= 0) return;

      dispatch(restockIngredient({
        ingredientId: entityId(ingredient),
        quantity: qty,
        reason: 'Reposición manual',
      }));
      dispatch(addJournalEntry({
        direction: 'in',
        category: 'inventory',
        description: `Reposición: ${ingredient.name}`,
        amount: qty * (ingredient.costPerUnit || 0),
      }));
    });
  };

  const handleDeleteProduct = (product: any) => {
    const productId = String(product?.id ?? product?._id ?? '');
    if (!productId) {
      Alert.alert('Error', 'No se pudo identificar el producto a eliminar');
      return;
    }

    const confirmDelete = () => {
      dispatch(deleteProduct(productId));
      Alert.alert('Eliminado', `${product.name} fue eliminado correctamente.`);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`¿Eliminar "${product.name}" y su receta?`)) {
        confirmDelete();
      }
      return;
    }

    Alert.alert('Eliminar Producto', `¿Eliminar "${product.name}" y su receta?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const getRecipeForProduct = (productId: string) => {
    return recipes.find((r: any) => r.productId === productId);
  };

  const filteredIngredients = ingredients.filter((i: any) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const componentOptions = ingredients.filter((ingredient: any) => entityId(ingredient) !== (editingIngredient ? entityId(editingIngredient) : ''));

  const componentDisplayName = (component: any) => {
    const componentId = String(component?.ingredientId?.id || component?.ingredientId?._id || component?.ingredientId || '');
    return ingredients.find((ingredient: any) => entityId(ingredient) === componentId)?.name || component?.ingredientId?.name || 'Ingrediente';
  };

  const componentDisplayUnit = (component: any) => {
    const componentId = String(component?.ingredientId?.id || component?.ingredientId?._id || component?.ingredientId || '');
    return ingredients.find((ingredient: any) => entityId(ingredient) === componentId)?.unit || component?.ingredientId?.unit || '';
  };

  const normalizeComponentsForForm = (components: any[] = []) => components.map((component) => ({
    ingredientId: String(component?.ingredientId?.id || component?.ingredientId?._id || component?.ingredientId || ''),
    quantity: String(component?.quantity ?? ''),
  })).filter((component) => component.ingredientId);

  const selectedComponentFor = (ingredientId: string) =>
    ingComponents.find((component) => component.ingredientId === ingredientId);

  const toggleComponent = (ingredient: any) => {
    const ingredientId = entityId(ingredient);
    const selected = selectedComponentFor(ingredientId);

    if (selected) {
      setIngComponents((prev) => prev.filter((component) => component.ingredientId !== ingredientId));
      return;
    }

    setIngComponents((prev) => [...prev, { ingredientId, quantity: '' }]);
  };

  const updateComponentQuantity = (ingredientId: string, quantity: string) => {
    setIngComponents((prev) =>
      prev.map((component) =>
        component.ingredientId === ingredientId ? { ...component, quantity } : component
      )
    );
  };

  const renderIngredientItem = ({ item }: { item: any }) => {
    const isLowStock = lowStockAlerts.includes(item.id);
    
    return (
      <View style={[styles.ingredientCard, isLowStock && styles.lowStockCard]}>
        <View style={styles.ingredientHeader}>
          <View>
            <Text style={styles.ingredientName}>{item.name}</Text>
            <Text style={styles.ingredientUnit}>Unidad: {item.unit}</Text>
          </View>
          <View style={[styles.stockBadge, isLowStock && styles.lowStockBadge]}>
            <Text style={styles.stockText} numberOfLines={1}>{item.stock} {item.unit}</Text>
          </View>
        </View>

        <View style={styles.ingredientDetails}>
          <Text style={styles.detailText}>Stock mínimo: {item.minStock} {item.unit}</Text>
          <Text style={styles.detailText}>Costo: ${item.costPerUnit.toFixed(3)}/{item.unit}</Text>
          <Text style={styles.detailText}>Valor total: ${(item.stock * item.costPerUnit).toFixed(2)}</Text>
        </View>

        {item.components?.length > 0 && (
          <View style={styles.compositionPreview}>
            <Text style={styles.compositionTitle}>Compuesto por:</Text>
            {item.components.map((component: any, index: number) => (
              <Text key={`${entityId(item)}-component-${index}`} style={styles.compositionItem}>
                • {componentDisplayName(component)}: {component.quantity} {componentDisplayUnit(component)}
              </Text>
            ))}
          </View>
        )}

        {isLowStock && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={16} color="#c0392b" />
            <Text style={styles.alertText}>¡Stock bajo!</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleRestock(item)}>
            <Ionicons name="add-circle" size={20} color="#27ae60" />
            <Text style={styles.actionText}>Reponer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              setEditingIngredient(item);
              setIngName(item.name || '');
              setIngUnit(item.unit || 'g');
              setIngStock(String(item.stock ?? ''));
              setIngMinStock(String(item.minStock ?? ''));
              setIngTotalCost(String(((item.stock || 0) * (item.costPerUnit || 0)).toFixed(2)));
              setIngPackageCount('');
              setIngQuantityPerPackage('');
              setIngComponents(normalizeComponentsForForm(item.components || []));
              setShowIngredientModal(true);
            }}
          >
            <Ionicons name="create" size={20} color="#d4a574" />
            <Text style={styles.actionText}>Ajustar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              const confirmDelete = () => dispatch(deleteIngredient(entityId(item)));

              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                if (window.confirm(`¿Eliminar ${item.name}?`)) confirmDelete();
                return;
              }

              Alert.alert('Eliminar', `¿Eliminar ${item.name}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: confirmDelete },
              ]);
            }}
          >
            <Ionicons name="trash" size={20} color="#c0392b" />
            <Text style={styles.actionText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProductItem = ({ item }: { item: any }) => {
    const productId = entityId(item);
    const recipe = getRecipeForProduct(productId);
    const totalCost = recipe?.items.reduce((sum: number, ri: any) => {
      const ing = ingredients.find((i: any) => i.id === ri.ingredientId);
      return sum + (ing?.costPerUnit || 0) * ri.quantity;
    }, 0) || 0;

    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.productImage} />
          ) : (
            <Text style={styles.productIcon}>{item.icon}</Text>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productCategory}>{item.category}</Text>
          </View>
          <View style={styles.productPrice}>
            <Text style={styles.priceText}>${item.price.toFixed(2)}</Text>
            <Text style={styles.costText}>Costo: ${totalCost.toFixed(2)}</Text>
          </View>
        </View>

        {recipe && (
          <View style={styles.recipePreview}>
            <Text style={styles.recipeTitle}>📝 Receta ({recipe.preparationTime} min):</Text>
            {recipe.image ? <Image source={{ uri: recipe.image }} style={styles.recipeImage} /> : null}
            {recipe.items.map((ri: any, idx: number) => {
              const ing = ingredients.find((i: any) => i.id === ri.ingredientId);
              return (
                <Text key={idx} style={styles.recipeItem}>
                  • {ing?.name}: {ri.quantity} {ing?.unit}
                </Text>
              );
            })}
            <Text style={styles.marginText}>
              Margen: {((item.price - totalCost) / item.price * 100).toFixed(1)}%
            </Text>
          </View>
        )}

        <View style={styles.productActions}>
          <TouchableOpacity 
            style={styles.productActionBtn}
            onPress={() => {
              setEditingProduct(item);
              setShowRecipeModal(true);
            }}
          >
            <Ionicons name="create-outline" size={18} color="#d4a574" />
            <Text style={styles.productActionText}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.productActionBtn, !item.isActive && styles.inactiveBtn]}
            onPress={() => {
              dispatch(toggleProductActive(productId));
              Alert.alert(
                'Estado actualizado',
                item.isActive ? `${item.name} ahora está inactivo` : `${item.name} ahora está activo`
              );
            }}
          >
            <Ionicons name={item.isActive ? 'eye' : 'eye-off'} size={18} color={item.isActive ? '#27ae60' : '#8b6f4e'} />
            <Text style={styles.productActionText}>{item.isActive ? 'Activo' : 'Inactivo'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.productActionBtn}
            onPress={() => handleDeleteProduct(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#c0392b" />
            <Text style={styles.productActionText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>📦 Gestión de Inventario</Text>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
          onPress={() => setActiveTab('ingredients')}
        >
          <Ionicons name="cube" size={20} color={activeTab === 'ingredients' ? '#1a0f0a' : '#d4a574'} />
          <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>Ingredientes</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons name="cafe" size={20} color={activeTab === 'products' ? '#1a0f0a' : '#d4a574'} />
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Productos</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8b6f4e" />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'ingredients' ? "Buscar ingrediente..." : "Buscar producto..."}
          placeholderTextColor="#8b6f4e"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Add Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => {
          if (activeTab === 'ingredients') {
            resetIngredientForm();
            setShowIngredientModal(true);
            return;
          }
          setShowRecipeModal(true);
        }}
      >
        <Ionicons name="add" size={24} color="#1a0f0a" />
        <Text style={styles.addButtonText}>
          {activeTab === 'ingredients' ? 'Añadir Ingrediente' : 'Nueva Receta'}
        </Text>
      </TouchableOpacity>

      {/* List */}
      {activeTab === 'ingredients' ? (
        <FlatList
          data={filteredIngredients}
          keyExtractor={(item) => entityId(item)}
          renderItem={renderIngredientItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => entityId(item)}
          renderItem={renderProductItem}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Modals */}
      <RecipeModal 
        visible={showRecipeModal} 
        onClose={() => {
          setShowRecipeModal(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
      />

      {/* Ingredient Modal */}
      <Modal visible={showIngredientModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isCompact && styles.modalContentCompact]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
            <Text style={styles.modalTitle} numberOfLines={2}>{editingIngredient ? '✏️ Editar Ingrediente' : '➕ Nuevo Ingrediente'}</Text>
            
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              style={styles.modalInput}
              value={ingName}
              onChangeText={setIngName}
              placeholder="Ej: Café Arábica"
              placeholderTextColor="#8b6f4e"
            />

            <Text style={styles.inputLabel}>Unidad</Text>
            <View style={styles.unitSelector}>
              {units.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, isCompact && styles.unitChipCompact, ingUnit === u && styles.unitChipActive]}
                  onPress={() => setIngUnit(u)}
                >
                  <Text style={[styles.unitText, ingUnit === u && styles.unitTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Compra por cajas / paquetes (opcional)</Text>
            <View style={styles.bulkCalculatorCard}>
              <Text style={styles.bulkCalculatorHelp}>
                Si compras varias cajas, escribe cuántas son y cuánto trae cada una. Ej: 10 cajas × 500 ml = 5000 ml en stock.
              </Text>
              <View style={styles.bulkInputRow}>
                <View style={styles.bulkInputColumn}>
                  <Text style={styles.bulkInputLabel}>Cajas / paquetes</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={ingPackageCount}
                    onChangeText={setIngPackageCount}
                    keyboardType="decimal-pad"
                    placeholder="Ej: 10"
                    placeholderTextColor="#8b6f4e"
                  />
                </View>
                <View style={styles.bulkInputColumn}>
                  <Text style={styles.bulkInputLabel}>Cantidad por caja ({ingUnit})</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={ingQuantityPerPackage}
                    onChangeText={setIngQuantityPerPackage}
                    keyboardType="decimal-pad"
                    placeholder="Ej: 500"
                    placeholderTextColor="#8b6f4e"
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.applyBulkBtn, bulkPurchaseStock <= 0 && styles.applyBulkBtnDisabled]}
                onPress={() => {
                  if (bulkPurchaseStock <= 0) {
                    Alert.alert('Datos incompletos', 'Ingresa cuántas cajas son y cuánto trae cada una.');
                    return;
                  }
                  setIngStock(String(bulkPurchaseStock));
                }}
              >
                <Ionicons name="calculator" size={18} color="#1a0f0a" />
                <Text style={styles.applyBulkBtnText}>Usar {bulkPurchaseStock > 0 ? `${bulkPurchaseStock} ${ingUnit}` : 'cálculo'} como stock</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Stock inicial total ({ingUnit})</Text>
            <TextInput
              style={styles.modalInput}
              value={ingStock}
              onChangeText={setIngStock}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#8b6f4e"
            />

            <Text style={styles.inputLabel}>Stock mínimo</Text>
            <TextInput
              style={styles.modalInput}
              value={ingMinStock}
              onChangeText={setIngMinStock}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#8b6f4e"
            />

            <Text style={styles.inputLabel}>Precio total pagado ($)</Text>
            <TextInput
              style={styles.modalInput}
              value={ingTotalCost}
              onChangeText={setIngTotalCost}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#8b6f4e"
            />
            <Text style={styles.calculatedCostText}>
              Costo unitario automático: ${calculatedUnitCost.toFixed(6)}/{ingUnit}
            </Text>

            <View style={styles.compositionHeader}>
              <View style={styles.compositionHeaderText}>
                <Text style={styles.inputLabel}>Composición</Text>
                <Text style={styles.compositionHelp}>Opcional: selecciona ingredientes y gramaje igual que en las recetas.</Text>
              </View>
            </View>

            {componentOptions.length === 0 ? (
              <Text style={styles.emptyCompositionText}>Crea otro ingrediente para poder usarlo como componente.</Text>
            ) : (
              <View style={styles.componentList}>
                {componentOptions.map((option: any) => {
                  const optionId = entityId(option);
                  const selectedComponent = selectedComponentFor(optionId);

                  return (
                    <View key={optionId} style={styles.componentIngredientRow}>
                      <TouchableOpacity
                        style={styles.componentIngredientCheck}
                        onPress={() => toggleComponent(option)}
                      >
                        <Ionicons
                          name={selectedComponent ? 'checkbox' : 'square-outline'}
                          size={24}
                          color="#d4a574"
                        />
                        <View style={styles.componentIngredientInfo}>
                          <Text style={styles.componentIngredientName} numberOfLines={1}>{option.name}</Text>
                          <Text style={styles.componentIngredientUnit}>Stock: {option.stock} {option.unit}</Text>
                        </View>
                      </TouchableOpacity>

                      {selectedComponent && (
                        <View style={styles.componentQtyInputWrap}>
                          <TextInput
                            style={styles.componentQtyInput}
                            value={selectedComponent.quantity}
                            onChangeText={(quantity) => updateComponentQuantity(optionId, quantity)}
                            keyboardType="decimal-pad"
                            placeholder={`0 ${option.unit}`}
                            placeholderTextColor="#8b6f4e"
                          />
                          <Text style={styles.componentQtyUnitBadge}>{option.unit}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { resetIngredientForm(); setShowIngredientModal(false); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIngredient}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f0a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f5f1e8',
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c1810',
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  tabActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  tabText: {
    color: '#8b6f4e',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1a0f0a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c1810',
    margin: 15,
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    color: '#f5f1e8',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4a574',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#1a0f0a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    padding: 15,
    paddingBottom: 100,
  },
  // Ingredient Card
  ingredientCard: {
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  lowStockCard: {
    borderColor: '#c0392b',
    borderWidth: 2,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ingredientName: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ingredientUnit: {
    color: '#8b6f4e',
    fontSize: 12,
    marginTop: 2,
  },
  stockBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  lowStockBadge: {
    backgroundColor: '#c0392b',
  },
  stockText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ingredientDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 10,
  },
  detailText: {
    color: '#8b6f4e',
    fontSize: 12,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192, 57, 43, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  alertText: {
    color: '#c0392b',
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#4a3428',
    paddingTop: 10,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#f5f1e8',
    fontSize: 12,
  },
  // Product Card
  productCard: {
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  productIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  productImage: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#1a0f0a',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  productCategory: {
    color: '#8b6f4e',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  productPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: '#d4a574',
    fontSize: 20,
    fontWeight: 'bold',
  },
  costText: {
    color: '#8b6f4e',
    fontSize: 12,
  },
  recipePreview: {
    backgroundColor: '#1a0f0a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  recipeImage: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#2c1810',
  },
  recipeTitle: {
    color: '#d4a574',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recipeItem: {
    color: '#8b6f4e',
    fontSize: 12,
    marginLeft: 8,
    marginBottom: 2,
  },
  marginText: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#4a3428',
    paddingTop: 12,
  },
  productActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productActionText: {
    color: '#f5f1e8',
    fontSize: 13,
  },
  inactiveBtn: {
    opacity: 0.6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1a0f0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    maxHeight: '88%',
  },
  modalContentCompact: {
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f5f1e8',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#d4a574',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 15,
  },
  modalInput: {
    backgroundColor: '#2c1810',
    borderRadius: 12,
    padding: 15,
    color: '#f5f1e8',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4a3428',
  },

  bulkCalculatorCard: {
    backgroundColor: '#21140d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4a3428',
    padding: 12,
    gap: 12,
  },
  bulkCalculatorHelp: {
    color: '#c7b8a0',
    fontSize: 13,
    lineHeight: 18,
  },
  bulkInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bulkInputColumn: {
    flex: 1,
  },
  bulkInputLabel: {
    color: '#d4a574',
    fontSize: 12,
    marginBottom: 6,
  },
  applyBulkBtn: {
    backgroundColor: '#d4a574',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBulkBtnDisabled: {
    opacity: 0.55,
  },
  applyBulkBtnText: {
    color: '#1a0f0a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  calculatedCostText: {
    color: '#d4a574',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    minWidth: 58,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2c1810',
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  unitChipCompact: {
    minWidth: 52,
    paddingHorizontal: 12,
  },
  unitChipActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  unitText: {
    color: '#8b6f4e',
  },
  unitTextActive: {
    color: '#1a0f0a',
    fontWeight: 'bold',
  },
  compositionPreview: {
    backgroundColor: '#1a0f0a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  compositionTitle: {
    color: '#d4a574',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
  },
  compositionItem: {
    color: '#d8c6b2',
    fontSize: 12,
    marginBottom: 2,
  },
  compositionHeader: {
    marginTop: 6,
  },
  compositionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  compositionHelp: {
    color: '#8b6f4e',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyCompositionText: {
    color: '#8b6f4e',
    fontSize: 12,
    backgroundColor: '#2c1810',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  componentList: {
    gap: 8,
  },
  componentIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2c1810',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4a3428',
    gap: 8,
  },
  componentIngredientCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  componentIngredientInfo: {
    flex: 1,
    minWidth: 0,
  },
  componentIngredientName: {
    color: '#f5f1e8',
    fontSize: 14,
    fontWeight: '600',
  },
  componentIngredientUnit: {
    color: '#8b6f4e',
    fontSize: 12,
  },
  componentQtyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  componentQtyInput: {
    width: 84,
    backgroundColor: '#1a0f0a',
    borderRadius: 8,
    padding: 8,
    color: '#f5f1e8',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#d4a574',
  },
  componentQtyUnitBadge: {
    color: '#d4a574',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    minWidth: 32,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 25,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#2c1810',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4a3428',
  },
  cancelBtnText: {
    color: '#f5f1e8',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default InventoryScreen;
