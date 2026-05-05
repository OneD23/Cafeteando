import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
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
  const { ingredients, lowStockAlerts } = useSelector((state: any) => state.inventory);
  const { products, recipes } = useSelector((state: any) => state.recipes);
  
  const [activeTab, setActiveTab] = useState<'ingredients' | 'products'>('ingredients');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Formulario de ingrediente
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('g');
  const [ingStock, setIngStock] = useState('');
  const [ingMinStock, setIngMinStock] = useState('');
  const [ingCost, setIngCost] = useState('');

  const units = ['g', 'ml', 'unidad', 'oz'];

  const handleAddIngredient = () => {
    if (!ingName || !ingStock || !ingMinStock || !ingCost) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    dispatch(addIngredient({
      name: ingName,
      unit: ingUnit as any,
      stock: parseFloat(ingStock),
      minStock: parseFloat(ingMinStock),
      costPerUnit: parseFloat(ingCost),
    }));
    dispatch(addJournalEntry({
      direction: 'in',
      category: 'inventory',
      description: `Alta ingrediente: ${ingName}`,
      amount: parseFloat(ingStock) * parseFloat(ingCost),
    }));

    // Reset
    setIngName('');
    setIngStock('');
    setIngMinStock('');
    setIngCost('');
    setShowIngredientModal(false);
  };

  const handleRestock = (ingredient: any) => {
    Alert.prompt(
      'Reposición',
      `Cantidad a añadir a ${ingredient.name}:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Añadir',
          onPress: (value) => {
            const qty = parseFloat(value || '0');
            if (qty > 0) {
              dispatch(restockIngredient({
                ingredientId: ingredient.id,
                quantity: qty,
                reason: 'Reposición manual',
              }));
              dispatch(addJournalEntry({
                direction: 'in',
                category: 'inventory',
                description: `Reposición: ${ingredient.name}`,
                amount: qty * (ingredient.costPerUnit || 0),
              }));
            }
          },
        },
      ],
      'plain-text'
    );
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
            <Text style={styles.stockText}>{item.stock} {item.unit}</Text>
          </View>
        </View>

        <View style={styles.ingredientDetails}>
          <Text style={styles.detailText}>Stock mínimo: {item.minStock} {item.unit}</Text>
          <Text style={styles.detailText}>Costo: ${item.costPerUnit.toFixed(3)}/{item.unit}</Text>
          <Text style={styles.detailText}>Valor total: ${(item.stock * item.costPerUnit).toFixed(2)}</Text>
        </View>

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
              Alert.prompt('Ajuste', 'Nuevo stock:', (value) => {
                const newStock = parseFloat(value || '0');
                if (!isNaN(newStock)) {
                  const diff = newStock - item.stock;
                  dispatch(adjustStock({
                    ingredientId: item.id,
                    newStock,
                    reason: 'Ajuste manual',
                  }));
                  dispatch(addJournalEntry({
                    direction: diff >= 0 ? 'in' : 'out',
                    category: 'adjustment',
                    description: `Ajuste inventario: ${item.name}`,
                    amount: Math.abs(diff) * (item.costPerUnit || 0),
                  }));
                }
              });
            }}
          >
            <Ionicons name="create" size={20} color="#d4a574" />
            <Text style={styles.actionText}>Ajustar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              Alert.alert('Eliminar', `¿Eliminar ${item.name}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => dispatch(deleteIngredient(item.id)) },
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
    const recipe = getRecipeForProduct(item.id);
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
              dispatch(toggleProductActive(item.id));
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
        onPress={() => activeTab === 'ingredients' ? setShowIngredientModal(true) : setShowRecipeModal(true)}
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
          keyExtractor={(item) => item.id}
          renderItem={renderIngredientItem}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>➕ Nuevo Ingrediente</Text>
            
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
                  style={[styles.unitChip, ingUnit === u && styles.unitChipActive]}
                  onPress={() => setIngUnit(u)}
                >
                  <Text style={[styles.unitText, ingUnit === u && styles.unitTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Stock inicial</Text>
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

            <Text style={styles.inputLabel}>Costo por unidad ($)</Text>
            <TextInput
              style={styles.modalInput}
              value={ingCost}
              onChangeText={setIngCost}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#8b6f4e"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowIngredientModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddIngredient}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#1a0f0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
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
  unitSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2c1810',
    borderWidth: 1,
    borderColor: '#4a3428',
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
