import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Modal, TextInput, Alert, ScrollView, Linking } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logout } from "../store/authSlice";
import { setTaxEnabled } from "../store/cartSlice";
import { api } from "../api/client";

const CLIENTS_STORAGE_KEY = "cafetrack_clients";
const SALES_STORAGE_KEY = "cafetrack_sales_history";

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);
  const { taxEnabled } = useSelector((state: any) => state.cart);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [mode, setMode] = useState<"bootstrap" | "register">("register");
  const [form, setForm] = useState({ username: "", email: "", name: "", password: "", role: "cashier" as "admin" | "manager" | "cashier" });
  const [isSaving, setIsSaving] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [clientForm, setClientForm] = useState({ id: "", name: "", phone: "", email: "", notes: "" });
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [promoText, setPromoText] = useState("Hola {cliente}, tenemos una promoción especial para ti en CafeTrack.");

  const loadClients = async () => {
    const [clientsRaw, salesRaw] = await Promise.all([
      AsyncStorage.getItem(CLIENTS_STORAGE_KEY),
      AsyncStorage.getItem(SALES_STORAGE_KEY),
    ]);
    setClients(clientsRaw ? JSON.parse(clientsRaw) : []);
    setSalesHistory(salesRaw ? JSON.parse(salesRaw) : []);
  };

  const persistClients = async (next: any[]) => {
    setClients(next);
    await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (showClientsModal) loadClients();
  }, [showClientsModal]);

  const saveClient = async () => {
    if (!clientForm.name.trim()) {
      Alert.alert("Dato requerido", "El nombre del cliente es obligatorio.");
      return;
    }

    const payload = {
      id: clientForm.id || `cli-${Date.now()}`,
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      email: clientForm.email.trim(),
      notes: clientForm.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    const next = clientForm.id
      ? clients.map((c) => (c.id === clientForm.id ? payload : c))
      : [payload, ...clients];

    await persistClients(next);
    setClientForm({ id: "", name: "", phone: "", email: "", notes: "" });
    Alert.alert("Éxito", clientForm.id ? "Cliente actualizado" : "Cliente creado");
  };

  const editClient = (client: any) => setClientForm(client);

  const deleteClient = (id: string) => {
    Alert.alert("Eliminar cliente", "¿Deseas eliminar este cliente?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await persistClients(clients.filter((c) => c.id !== id));
          if (clientForm.id === id) setClientForm({ id: "", name: "", phone: "", email: "", notes: "" });
        },
      },
    ]);
  };


  const getClientPurchases = (clientName: string) => {
    const rows = salesHistory.filter((s: any) => String(s.customerName || "").trim().toLowerCase() === clientName.trim().toLowerCase());
    const total = rows.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
    return { count: rows.length, total };
  };

  const sendPromoWhatsApp = async (client: any) => {
    if (!client.phone) return Alert.alert("Falta teléfono", "Este cliente no tiene número de WhatsApp.");
    const msg = encodeURIComponent(promoText.replace('{cliente}', client.name));
    const phone = String(client.phone).replace(/[^0-9]/g, '');
    await Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
  };

  const sendPromoEmail = async (client: any) => {
    if (!client.email) return Alert.alert("Falta email", "Este cliente no tiene correo electrónico.");
    const subject = encodeURIComponent('Promoción CafeTrack');
    const body = encodeURIComponent(promoText.replace('{cliente}', client.name));
    await Linking.openURL(`mailto:${client.email}?subject=${subject}&body=${body}`);
  };

  const handleCreateUser = async () => {
    if (!form.username || !form.email || !form.name || !form.password) {
      Alert.alert("Datos incompletos", "Completa todos los campos.");
      return;
    }
    try {
      setIsSaving(true);
      if (mode === "bootstrap") await api.bootstrapAdmin({ username: form.username, email: form.email, name: form.name, password: form.password });
      else await api.registerUser(form);
      Alert.alert("Éxito", "Usuario creado correctamente.");
      setForm({ username: "", email: "", name: "", password: "", role: "cashier" });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No fue posible crear el usuario.");
    } finally {
      setIsSaving(false);
    }
  };

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

      <TouchableOpacity style={styles.usersButton} onPress={() => setShowClientsModal(true)}>
        <Text style={styles.usersButtonText}>Gestión de Clientes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={() => dispatch(logout())}><Text style={styles.logoutText}>Cerrar Sesión</Text></TouchableOpacity>

      <TouchableOpacity style={styles.usersButton} onPress={() => {
        if (user?.role !== "admin") return Alert.alert("Acceso denegado", "Solo administradores pueden gestionar usuarios.");
        setShowUsersModal(true);
      }}>
        <Text style={styles.usersButtonText}>Gestión de Usuarios</Text>
      </TouchableOpacity>

      <Modal visible={showClientsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Gestión de clientes</Text>
          <TextInput style={styles.input} placeholder="Nombre*" value={clientForm.name} onChangeText={(name) => setClientForm((p) => ({ ...p, name }))} placeholderTextColor="#8b6f4e" />
          <TextInput style={styles.input} placeholder="Teléfono" value={clientForm.phone} onChangeText={(phone) => setClientForm((p) => ({ ...p, phone }))} placeholderTextColor="#8b6f4e" />
          <TextInput style={styles.input} placeholder="Email" value={clientForm.email} onChangeText={(email) => setClientForm((p) => ({ ...p, email }))} placeholderTextColor="#8b6f4e" />
          <TextInput style={styles.input} placeholder="Notas" value={clientForm.notes} onChangeText={(notes) => setClientForm((p) => ({ ...p, notes }))} placeholderTextColor="#8b6f4e" />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setClientForm({ id: "", name: "", phone: "", email: "", notes: "" })}><Text style={styles.secondaryBtnText}>Limpiar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={saveClient}><Text style={styles.primaryBtnText}>{clientForm.id ? "Actualizar" : "Guardar"}</Text></TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder="Mensaje promo (usa {cliente})" value={promoText} onChangeText={setPromoText} placeholderTextColor="#8b6f4e" />

          <ScrollView style={{ maxHeight: 220, marginTop: 10 }}>
            {clients.length === 0 ? <Text style={styles.version}>Sin clientes registrados</Text> : clients.map((client) => (
              <View key={client.id} style={styles.clientItem}>
                <View style={{ flex: 1 }}><Text style={styles.clientName}>{client.name}</Text><Text style={styles.version}>{client.phone || client.email || "Sin contacto"}</Text><Text style={styles.version}>Compras: {getClientPurchases(client.name).count} | Total: ${getClientPurchases(client.name).total.toFixed(2)}</Text></View>
                <TouchableOpacity onPress={() => sendPromoWhatsApp(client)}><Text style={styles.editText}>WhatsApp</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => sendPromoEmail(client)}><Text style={styles.editText}>Email</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => editClient(client)}><Text style={styles.editText}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteClient(client.id)}><Text style={styles.deleteText}>Eliminar</Text></TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={() => setShowClientsModal(false)}><Text style={styles.secondaryBtnText}>Cerrar</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showUsersModal} transparent animationType="slide"><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Crear usuario</Text>
        <View style={styles.switchRow}>{(["register", "bootstrap"] as const).map((m) => <TouchableOpacity key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}><Text style={styles.modeText}>{m === "register" ? "Registro normal" : "Bootstrap admin"}</Text></TouchableOpacity>)}</View>
        <TextInput style={styles.input} placeholder="Nombre" value={form.name} onChangeText={(name) => setForm((prev) => ({ ...prev, name }))} placeholderTextColor="#8b6f4e" />
        <TextInput style={styles.input} placeholder="Usuario" value={form.username} onChangeText={(username) => setForm((prev) => ({ ...prev, username }))} autoCapitalize="none" placeholderTextColor="#8b6f4e" />
        <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={(email) => setForm((prev) => ({ ...prev, email }))} autoCapitalize="none" placeholderTextColor="#8b6f4e" />
        <TextInput style={styles.input} placeholder="Contraseña" value={form.password} onChangeText={(password) => setForm((prev) => ({ ...prev, password }))} secureTextEntry placeholderTextColor="#8b6f4e" />
        {mode === "register" && <View style={styles.roleRow}>{(["cashier", "manager", "admin"] as const).map((role) => <TouchableOpacity key={role} style={[styles.roleBtn, form.role === role && styles.roleBtnActive]} onPress={() => setForm((prev) => ({ ...prev, role }))}><Text style={styles.roleBtnText}>{role}</Text></TouchableOpacity>)}</View>}
        <View style={styles.modalActions}><TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowUsersModal(false)}><Text style={styles.secondaryBtnText}>Cerrar</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtn} onPress={handleCreateUser} disabled={isSaving}><Text style={styles.primaryBtnText}>{isSaving ? "Guardando..." : "Crear"}</Text></TouchableOpacity></View>
      </View></View></Modal>
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
