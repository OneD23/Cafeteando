import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import { setTaxEnabled } from "../store/cartSlice";
import { pendingQueue, syncPendingData } from "../services/localDb";


const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);
  const { taxEnabled } = useSelector((state: any) => state.cart);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refreshPendingSync = async () => {
    const pending = await pendingQueue();
    setPendingSyncCount(pending.length);
  };

  React.useEffect(() => {
    refreshPendingSync();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>⚙️ Ajustes</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || "Usuario"}</Text>
        <Text style={styles.role}>{user?.role === "admin" ? "Administrador" : "Cajero"}</Text>
      </View>

      <View style={styles.optionCard}>
        <View><Text style={styles.optionTitle}>Aplicar impuestos (16%)</Text><Text style={styles.optionSubtitle}>Activa o desactiva IVA en el total del POS.</Text></View>
        <TouchableOpacity style={[styles.toggleBtn, taxEnabled ? styles.toggleOn : styles.toggleOff]} onPress={() => dispatch(setTaxEnabled(!taxEnabled))}>
          <Text style={styles.toggleText}>{taxEnabled ? "Activado" : "Desactivado"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.optionCard}>
        <View>
          <Text style={styles.optionTitle}>Sincronización offline</Text>
          <Text style={styles.optionSubtitle}>Pendientes: {pendingSyncCount}</Text>
        </View>
        <TouchableOpacity style={styles.usersButton} onPress={async () => { await syncPendingData(); await refreshPendingSync(); }}>
          <Text style={styles.usersButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => {
        if (pendingSyncCount > 0) return Alert.alert("Sincronización pendiente", "Tienes datos sin sincronizar. Reintenta sincronizar antes de cerrar sesión.");
        dispatch(logout());
      }}><Text style={styles.logoutText}>Cerrar Sesión</Text></TouchableOpacity>

      <View style={styles.optionCard}>
        <View>
          <Text style={styles.optionTitle}>Gestión de usuarios</Text>
          <Text style={styles.optionSubtitle}>Usa la pestaña Usuarios para crear empleados y clientes.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0f0a" },
  title: { fontSize: 28, fontWeight: "bold", color: "#f5f1e8", padding: 20 },
  card: { backgroundColor: "#2c1810", margin: 15, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#4a3428" },
  name: { color: "#f5f1e8", fontSize: 20, fontWeight: "bold" }, role: { color: "#d4a574", marginTop: 5 },
  logoutButton: { backgroundColor: "#c0392b", margin: 15, padding: 18, borderRadius: 12, alignItems: "center" },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  usersButton: { backgroundColor: "#2c1810", marginHorizontal: 15, marginTop: 10, padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#4a3428" },
  usersButtonText: { color: "#d4a574", fontWeight: "bold" }, optionCard: { backgroundColor: "#2c1810", marginHorizontal: 15, marginTop: 4, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#4a3428", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  optionTitle: { color: "#f5f1e8", fontWeight: "700", marginBottom: 4 }, optionSubtitle: { color: "#8b6f4e", fontSize: 12 },
  toggleBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, toggleOn: { backgroundColor: "#2e7d32" }, toggleOff: { backgroundColor: "#6d4c41" }, toggleText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#1a0f0a", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#4a3428" },
  modalTitle: { color: "#f5f1e8", fontSize: 20, fontWeight: "700", marginBottom: 10 },
  input: { backgroundColor: "#2c1810", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#f5f1e8", borderWidth: 1, borderColor: "#4a3428", marginBottom: 10 },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, gap: 10 },
  secondaryBtn: { flex: 1, backgroundColor: "#3a2a20", borderRadius: 10, padding: 12, alignItems: "center" }, secondaryBtnText: { color: "#f5f1e8", fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: "#d4a574", borderRadius: 10, padding: 12, alignItems: "center" }, primaryBtnText: { color: "#1a0f0a", fontWeight: "800" },
  switchRow: { flexDirection: "row", gap: 8, marginBottom: 10 }, modeBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#4a3428", backgroundColor: "#2c1810" }, modeBtnActive: { backgroundColor: "#d4a574" }, modeText: { textAlign: "center", color: "#f5f1e8", fontSize: 12 },
  roleRow: { flexDirection: "row", gap: 8, marginVertical: 8 }, roleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#4a3428", alignItems: "center" }, roleBtnActive: { backgroundColor: "#2e7d32" }, roleBtnText: { color: "#f5f1e8", fontWeight: "700", fontSize: 12 },
  clientItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#3a2a20" }, clientName: { color: "#f5f1e8", fontWeight: "700" }, editText: { color: "#d4a574", fontWeight: "700" }, deleteText: { color: "#c0392b", fontWeight: "700" }, version: { color: "#8b6f4e", fontSize: 12 },
});

export default SettingsScreen;
