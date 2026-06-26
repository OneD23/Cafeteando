import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { addToCart, clearCart, processSale, removeFromCart, setDiscount, updateQuantity } from "../store/cartSlice";
import { PaymentModal } from "../components/PaymentModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api/client";

const SALES_STORAGE_KEY = "cafetrack_sales_history";

const POSScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { items: cartItems, totals, processingSale } = useSelector((state: any) => state.cart);
  const { products, recipes, loading: loadingProducts, error: productsError } = useSelector((state: any) => state.recipes);
  const { ingredients } = useSelector((state: any) => state.inventory);
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cartCollapsed, setCartCollapsed] = useState(false);
  const [cashOpenModal, setCashOpenModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [countedCash, setCountedCash] = useState("0");
  const [cashExpected, setCashExpected] = useState(0);
  const [cashSessionOpen, setCashSessionOpen] = useState(false);
  const [clients, setClients] = useState<Array<{ id?: string; name: string }>>([]);
  const hasInventoryData = ingredients.length > 0;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const productColumns = width >= 1500 ? 4 : width >= 1000 ? 3 : 2;
  React.useEffect(() => {
    (async () => {
      const remote = await api.getCashSession();
      const cs = remote?.data || { isOpen: false };
      setCashSessionOpen(!!cs?.isOpen);
      if (cs?.openingAmount) setOpeningAmount(String(cs.openingAmount));
      const expectedCash = Number(cs?.summary?.expectedCash || cs?.openingAmount || 0);
      setCashExpected(expectedCash);
      setCountedCash(String(expectedCash));
      const rawClients = await AsyncStorage.getItem('cafetrack_clients');
      const parsedClients = rawClients ? JSON.parse(rawClients) : [];
      setClients(parsedClients.filter((c: any) => !!String(c?.name || '').trim()));
    })();
  }, []);
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
    const cashResponse = await api.getCashSession();
    const cashSession = cashResponse?.data || { isOpen: false };
    if (!cashSession?.isOpen) {
      Alert.alert("Caja cerrada", "Debes hacer apertura de caja en Contabilidad antes de vender.");
      return;
    }
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
      await persistSaleForClient({
        saleId: result.saleId,
        customerName: paymentData.customer?.name,
        total: saleTotals.total,
        items: saleItems.map((i: any) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
        date: new Date().toISOString(),
      });
      Alert.alert("Venta completada", "Se descontaron ingredientes del inventario.");
      setShowPaymentModal(false);
      printInvoice(result.saleId, saleItems, saleTotals);
    } catch (error: any) {
      Alert.alert("No se pudo completar", error?.message || "Error al procesar la venta");
    }
  };


  const persistSaleForClient = async (payload: { saleId: string; customerName?: string; total: number; items: any[]; date: string }) => {
    if (!payload.customerName?.trim()) return;
    const raw = await AsyncStorage.getItem(SALES_STORAGE_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(payload);
    await AsyncStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(history.slice(0, 500)));
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
          <head>
            <title>Factura ${saleId}</title>
            <style>
              @page { size: 80mm auto; margin: 6mm; }
              * { box-sizing: border-box; }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #111;
                font-size: 12px;
              }
              .receipt {
                width: 72mm;
                margin: 0 auto;
              }
              h2 { margin: 0 0 8px 0; font-size: 18px; text-align: center; }
              p { margin: 3px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border-bottom: 1px dashed #999; padding: 4px 2px; text-align: left; font-size: 11px; }
              th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: right; }
              .totals { margin-top: 10px; }
              .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
              .grand { font-size: 16px; font-weight: 700; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
              @media print {
                html, body { width: 80mm; }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <h2>CafeTrack</h2>
              <p><strong>Factura:</strong> ${saleId}</p>
              <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>P.Unit</th><th>Total</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
              <div class="totals">
                <div class="total-row"><span>Subtotal</span><span>$${saleTotals.subtotal.toFixed(2)}</span></div>
                <div class="total-row"><span>Impuesto</span><span>$${saleTotals.tax.toFixed(2)}</span></div>
                <div class="total-row grand"><span>Total</span><span>$${saleTotals.total.toFixed(2)}</span></div>
              </div>
            </div>
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
      
      <View style={[styles.header, width >= 900 && styles.headerWide]}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Terminal de ventas</Text>
          <Text style={styles.title}>Cafeteando POS</Text>
          <Text style={styles.subtitle}>Catálogo, caja e inventario en tiempo real</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statLabel}>Total actual</Text>
          <Text style={styles.statTotal}>${totals.total.toFixed(2)}</Text>
          <TouchableOpacity style={[styles.cashPill, cashSessionOpen ? styles.cashPillOpen : styles.cashPillClosed]} onPress={() => setCashOpenModal(true)}>
            <View style={[styles.cashDot, { backgroundColor: cashSessionOpen ? '#12b76a' : '#f04438' }]} />
            <Text style={styles.cashPillText}>{cashSessionOpen ? 'Caja abierta' : 'Caja cerrada'}</Text>
          </TouchableOpacity>
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
        key={`products-${productColumns}`}
        numColumns={productColumns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.productsGrid, { paddingBottom: cartItems.length > 0 ? (cartCollapsed ? 120 : 380) : 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No hay productos para mostrar</Text>
            <Text style={styles.emptyStateSubtitle}>
              {loadingProducts ? 'Cargando productos...' : productsError ? productsError : 'Verifica búsqueda, categorías o inventario disponible.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.productCard, { maxWidth: `${100 / productColumns}%` }]}
            onPress={() => handleAddToCart(item)}
            activeOpacity={0.88}
          >
            <View style={styles.productTopRow}>
              <View style={styles.productIconWrap}>
                <Text style={styles.productIcon}>{item.icon || '☕'}</Text>
              </View>
              <View style={[styles.stockBadge, hasInventoryData && item.stock <= 3 ? styles.stockBadgeLow : styles.stockBadgeOk]}>
                <Text style={styles.stockBadgeText}>{hasInventoryData ? `${item.stock} disp.` : 'Stock —'}</Text>
              </View>
            </View>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.productBottomRow}>
              <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
              <View style={styles.addCircle}>
                <Ionicons name="add" size={18} color="#1a0f0a" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {cartItems.length > 0 && (
        <View style={[styles.cartSheet, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}>
          <View style={styles.cartTitleRow}>
            <TouchableOpacity style={styles.cartTitleBtn} onPress={() => setCartCollapsed((prev) => !prev)}>
              <Text style={styles.cartTitle}>🛒 Carrito ({cartItems.length})</Text>
              <Ionicons name={cartCollapsed ? "chevron-up" : "chevron-down"} size={20} color="#d4a574" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dispatch(clearCart())}>
              <Text style={styles.clearCart}>Vaciar</Text>
            </TouchableOpacity>
          </View>
          {!cartCollapsed && (
            <FlatList
              data={cartItems}
              keyExtractor={(item) => item.id}
              style={styles.cartList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: any) => (
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
              )}
            />
          )}
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>TOTAL</Text>
            <Text style={styles.cartTotalValue}>${totals.total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={[styles.cashControlBtn, { backgroundColor: cashSessionOpen ? '#c0392b' : '#27ae60' }]} onPress={() => setCashOpenModal(true)}>
            <Text style={styles.cashControlText}>{cashSessionOpen ? 'Cerrar caja' : 'Abrir caja'}</Text>
          </TouchableOpacity>
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
        clients={clients}
      />
      <Modal visible={cashOpenModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cartTitle}>Control de Caja</Text>
            {!cashSessionOpen ? (
              <><TextInput style={styles.searchInput} value={openingAmount} onChangeText={setOpeningAmount} keyboardType="decimal-pad" placeholder="Monto apertura" placeholderTextColor="#8b6f4e" />
              <TouchableOpacity style={styles.checkoutButton} onPress={async () => {
                await api.openCashSession(Number(openingAmount || 0));
                setCashExpected(Number(openingAmount || 0));
                setCountedCash(String(Number(openingAmount || 0)));
                setCashSessionOpen(true);
                setCashOpenModal(false);
              }}>
                <Text style={styles.checkoutText}>Abrir Caja</Text>
              </TouchableOpacity></>
            ) : (
              <><Text style={styles.cashExpectedText}>Efectivo esperado: ${cashExpected.toFixed(2)}</Text><TextInput style={styles.searchInput} value={countedCash} onChangeText={setCountedCash} keyboardType="decimal-pad" placeholder="Efectivo contado" placeholderTextColor="#8b6f4e" />
              <TouchableOpacity style={[styles.checkoutButton, { backgroundColor: '#c0392b' }]} onPress={async () => {
                const rawSales = await AsyncStorage.getItem('cafetrack_sales_history');
                const sales = rawSales ? JSON.parse(rawSales) : [];
                const today = new Date().toDateString();
                const salesToday = sales.filter((s: any) => new Date(s.date).toDateString() === today);
                const total = salesToday.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
                const report = { date: new Date().toISOString(), openingAmount: Number(openingAmount || 0), salesCount: salesToday.length, totalSales: total, net: total - Number(openingAmount || 0) };
                await AsyncStorage.setItem('cash_close_report', JSON.stringify(report));
                await api.closeCashSession(Number(countedCash || 0), `Cierre POS. Ventas locales: ${salesToday.length}`);
                setCashExpected(0);
                setCashSessionOpen(false);
                setCashOpenModal(false);
                Alert.alert('Cierre de caja', `Ventas: ${salesToday.length} | Total: $${total.toFixed(2)}`);
              }}>
                <Text style={[styles.checkoutText, { color: '#fff' }]}>Cerrar Caja y Reporte</Text>
              </TouchableOpacity></>
            )}
            <TouchableOpacity style={[styles.qtyBtn, { marginTop: 10, width: '100%', height: 40 }]} onPress={() => setCashOpenModal(false)}><Text style={styles.qtyBtnText}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1118",
  },
  header: {
    margin: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2c1810",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
  },
  headerWide: {
    paddingHorizontal: 22,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 14,
  },
  eyebrow: {
    color: "#d4a574",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#f5f1e8",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#8b6f4e",
    fontSize: 12,
    marginTop: 3,
  },
  statsCard: {
    minWidth: 128,
    alignItems: "flex-end",
  },
  statLabel: {
    color: "#8b6f4e",
    fontSize: 11,
    fontWeight: "700",
  },
  statTotal: {
    color: "#d4a574",
    fontSize: 24,
    fontWeight: "900",
    marginVertical: 4,
  },
  cashPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cashPillOpen: { backgroundColor: "rgba(18,183,106,0.14)" },
  cashPillClosed: { backgroundColor: "rgba(240,68,56,0.14)" },
  cashDot: { width: 7, height: 7, borderRadius: 4 },
  cashPillText: { color: "#d8c6b2", fontSize: 11, fontWeight: "800" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#263244",
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
    backgroundColor: "#111827",
    borderColor: "#263244",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: "#f4b86a",
    borderColor: "#f4b86a",
  },
  categoryChipText: {
    color: "#f4b86a",
    fontSize: 12,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#0b1118",
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
    margin: 7,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.18)",
    minHeight: 132,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  productTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  productIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,165,116,0.16)",
  },
  productIcon: {
    fontSize: 24,
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stockBadgeOk: {
    backgroundColor: "rgba(18,183,106,0.13)",
  },
  stockBadgeLow: {
    backgroundColor: "rgba(240,68,56,0.16)",
  },
  stockBadgeText: {
    color: "#d8c6b2",
    fontSize: 10,
    fontWeight: "800",
  },
  productName: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "800",
    minHeight: 34,
  },
  productBottomRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productPrice: {
    color: "#d4a574",
    fontSize: 18,
    fontWeight: "900",
  },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d4a574",
    alignItems: "center",
    justifyContent: "center",
  },
  cartSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2c1810",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 3,
    borderTopColor: "#f4b86a",
    padding: 20,
    paddingBottom: 30,
    maxHeight: 400,
  },
  cartTitle: {
    color: "#f5f1e8",
    fontSize: 18,
    fontWeight: "bold",
  },
  cartTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  cartList: {
    maxHeight: 190,
    marginBottom: 8,
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
    backgroundColor: "#111827",
    borderColor: "#263244",
    borderWidth: 1,
    borderRadius: 8,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    color: "#f4b86a",
    fontWeight: "700",
  },
  qtyValue: {
    color: "#f5f1e8",
    fontWeight: "700",
    minWidth: 16,
    textAlign: "center",
  },
  cartItemPrice: {
    color: "#f4b86a",
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
  cashControlBtn: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cashControlText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cashExpectedText: {
    color: '#d4a574',
    marginTop: 12,
    fontWeight: '700',
  },
  checkoutText: {
    color: "#0b1118",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1a0f0a', borderWidth: 1, borderColor: '#4a3428', borderRadius: 14, padding: 16 },
});

export default POSScreen;
