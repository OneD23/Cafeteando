import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { addToCart, clearCart, processSale, removeFromCart, setDiscount, updateQuantity } from "../store/cartSlice";
import { PaymentModal } from "../components/PaymentModal";

const POSScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { items: cartItems, totals, processingSale } = useSelector((state: any) => state.cart);
  const { products, recipes } = useSelector((state: any) => state.recipes);
  const { ingredients } = useSelector((state: any) => state.inventory);
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const hasInventoryData = ingredients.length > 0;
  const categories = useMemo<string[]>(() => {
    const allCategories = Array.from(
      new Set<string>(products.map((p: any) => String(p.category || "")).filter(Boolean))
    );
    return ["all", ...allCategories];
  }, [products]);

  const availableProducts = useMemo(() => {
    return products.map((product: any) => {
      const recipe = recipes.find((r: any) => r.productId === product.id);
      if (!recipe) {
        return { ...product, stock: 9999 };
      }

      if (!hasInventoryData) {
        return { ...product, stock: 9999 };
      }

      const maxFromIngredients = recipe.items.reduce((minQty: number, ri: any) => {
        const ingredient = ingredients.find((ing: any) => ing.id === ri.ingredientId);
        const possible = ingredient ? Math.floor(ingredient.stock / ri.quantity) : 0;
        return Math.min(minQty, possible);
      }, Number.MAX_SAFE_INTEGER);

      return {
        ...product,
        stock: Number.isFinite(maxFromIngredients) ? maxFromIngredients : 0,
      };
    });
  }, [products, recipes, ingredients, hasInventoryData]);

  const filteredProducts = useMemo(() => {
    return availableProducts.filter((p: any) => {
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const hasStock = hasInventoryData ? p.stock > 0 : true;
      return p.isActive && matchesCategory && matchesSearch && hasStock;
    });
  }, [availableProducts, selectedCategory, searchQuery, hasInventoryData]);

  const handleAddToCart = (product: any) => {
    if (product.stock <= 0) {
      Alert.alert("Sin Stock", "Producto agotado");
      return;
    }
    dispatch(addToCart(product));
  };

  const handleCompleteSale = async () => {
    if (!cartItems.length) {
      Alert.alert("Carrito vacío", "Agrega al menos un producto para continuar.");
      return;
    }
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (paymentData: {
    method: "cash" | "card" | "transfer";
    discount: number;
    customer?: { name: string } | null;
  }) => {
    const saleItems = [...cartItems];
    const saleTotals = { ...totals };

    try {
      if (paymentData.discount > 0) {
        dispatch(setDiscount({ type: "fixed", value: paymentData.discount }));
      }

      const result = await dispatch(
        processSale({
          paymentMethod: paymentData.method,
          customerName: paymentData.customer?.name,
        }) as any
      ).unwrap();
      Alert.alert("Venta completada", "Se descontaron ingredientes del inventario.");
      setShowPaymentModal(false);
      printInvoice(result.saleId, saleItems, saleTotals);
    } catch (error: any) {
      Alert.alert("No se pudo completar", error?.message || "Error al procesar la venta");
    }
  };

  const printInvoice = (saleId: string, items: any[], saleTotals: any) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const rows = items
        .map(
          (item: any) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${item.price.toFixed(2)}</td>
              <td>$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `
        )
        .join("");

      const html = `
        <html>
          <head><title>Factura ${saleId}</title></head>
          <body style="font-family: Arial; padding: 20px;">
            <h2>CafeTrack - Factura</h2>
            <p><strong>Folio:</strong> ${saleId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <table border="1" cellspacing="0" cellpadding="8" width="100%">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <h3>Subtotal: $${saleTotals.subtotal.toFixed(2)}</h3>
            <h3>Impuesto: $${saleTotals.tax.toFixed(2)}</h3>
            <h2>Total: $${saleTotals.total.toFixed(2)}</h2>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
      return;
    }

    Alert.alert("Factura", `Venta ${saleId} registrada. Impresión web no disponible en esta plataforma.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0f0a" />
      
      <View style={styles.header}>
        <Text style={styles.title}>☕ CafeTrack POS</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>Items: {cartItems.length}</Text>
          <Text style={styles.statTotal}>${totals.total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8b6f4e" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto..."
          placeholderTextColor="#8b6f4e"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesRow}>
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                {category === "all" ? "Todo" : category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productsGrid}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No hay productos para mostrar</Text>
            <Text style={styles.emptyStateSubtitle}>
              Verifica búsqueda, categorías o inventario disponible.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.productCard}
            onPress={() => handleAddToCart(item)}
          >
            <Text style={styles.productIcon}>{item.icon}</Text>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
            <Text style={styles.productStock}>
              Stock: {hasInventoryData ? item.stock : "—"}
            </Text>
          </TouchableOpacity>
        )}
      />

      {cartItems.length > 0 && (
        <View style={styles.cartSheet}>
          <View style={styles.cartTitleRow}>
            <Text style={styles.cartTitle}>🛒 Carrito ({cartItems.length})</Text>
            <TouchableOpacity onPress={() => dispatch(clearCart())}>
              <Text style={styles.clearCart}>Vaciar</Text>
            </TouchableOpacity>
          </View>
          {cartItems.map((item: any) => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.cartItemLeft}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => dispatch(updateQuantity({ id: item.id, qty: item.quantity - 1 }))}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => dispatch(updateQuantity({ id: item.id, qty: item.quantity + 1 }))}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.cartItemRight}>
                <Text style={styles.cartItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => dispatch(removeFromCart(item.id))}>
                  <Ionicons name="trash-outline" size={18} color="#d96d61" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>TOTAL</Text>
            <Text style={styles.cartTotalValue}>${totals.total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCompleteSale}>
            <Text style={styles.checkoutText}>COMPLETAR VENTA</Text>
          </TouchableOpacity>
        </View>
      )}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handleConfirmPayment}
        total={totals.total}
        loading={processingSale}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a0f0a",
  },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#f5f1e8",
    fontSize: 20,
    fontWeight: "bold",
  },
  stats: {
    alignItems: "flex-end",
  },
  stat: {
    color: "#8b6f4e",
    fontSize: 12,
  },
  statTotal: {
    color: "#d4a574",
    fontSize: 18,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c1810",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  searchInput: {
    flex: 1,
    padding: 12,
    color: "#f5f1e8",
    fontSize: 16,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: "#2c1810",
    borderColor: "#4a3428",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: "#d4a574",
    borderColor: "#d4a574",
  },
  categoryChipText: {
    color: "#d4a574",
    fontSize: 12,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#1a0f0a",
  },
  productsGrid: {
    padding: 8,
    paddingBottom: 300,
  },
  emptyState: {
    marginTop: 28,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    color: "#f5f1e8",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyStateSubtitle: {
    marginTop: 6,
    color: "#8b6f4e",
    fontSize: 13,
    textAlign: "center",
  },
  productCard: {
    flex: 1,
    backgroundColor: "#2c1810",
    margin: 6,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4a3428",
    maxWidth: "47%",
  },
  productIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  productName: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  productPrice: {
    color: "#d4a574",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 5,
  },
  productStock: {
    color: "#8b6f4e",
    fontSize: 11,
    marginTop: 4,
  },
  cartSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a0f0a",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 3,
    borderTopColor: "#d4a574",
    padding: 20,
    paddingBottom: 30,
    maxHeight: 400,
  },
  cartTitle: {
    color: "#f5f1e8",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  cartTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clearCart: {
    color: "#d96d61",
    fontWeight: "700",
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    alignItems: "center",
  },
  cartItemLeft: {
    flex: 1,
  },
  cartItemRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  cartItemName: {
    color: "#f5f1e8",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  qtyBtn: {
    backgroundColor: "#2c1810",
    borderColor: "#4a3428",
    borderWidth: 1,
    borderRadius: 8,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    color: "#d4a574",
    fontWeight: "700",
  },
  qtyValue: {
    color: "#f5f1e8",
    fontWeight: "700",
    minWidth: 16,
    textAlign: "center",
  },
  cartItemPrice: {
    color: "#d4a574",
  },
  cartTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#4a3428",
  },
  cartTotalLabel: {
    color: "#f5f1e8",
    fontSize: 16,
    fontWeight: "bold",
  },
  cartTotalValue: {
    color: "#27ae60",
    fontSize: 24,
    fontWeight: "bold",
  },
  checkoutButton: {
    backgroundColor: "#d4a574",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 15,
  },
  checkoutText: {
    color: "#1a0f0a",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default POSScreen;
