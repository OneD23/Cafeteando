import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Modal, TextInput, Alert } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import { api } from "../api/client";

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [mode, setMode] = useState<"bootstrap" | "register">("register");
  const [form, setForm] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    role: "cashier" as "admin" | "manager" | "cashier",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateUser = async () => {
    if (!form.username || !form.email || !form.name || !form.password) {
      Alert.alert("Datos incompletos", "Completa todos los campos.");
      return;
    }

    try {
      setIsSaving(true);

      if (mode === "bootstrap") {
        await api.bootstrapAdmin({
          username: form.username,
          email: form.email,
          name: form.name,
          password: form.password,
        });
      } else {
        await api.registerUser(form);
      }

      Alert.alert("Éxito", "Usuario creado correctamente.");
      setForm({
        username: "",
        email: "",
        name: "",
        password: "",
        role: "cashier",
      });
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
        <Text style={styles.role}>
          {user?.role === "admin" ? "Administrador" : "Cajero"}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={() => dispatch(logout())}
      >
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.usersButton}
        onPress={() => {
          if (user?.role !== "admin") {
            Alert.alert("Acceso denegado", "Solo administradores pueden gestionar usuarios.");
            return;
          }
          setShowUsersModal(true);
        }}
      >
        <Text style={styles.usersButtonText}>Gestión de Usuarios</Text>
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={styles.version}>CafeTrack v2.0.0</Text>
      </View>

      <Modal visible={showUsersModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear usuario</Text>

            <View style={styles.switchRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "register" && styles.modeBtnActive]}
                onPress={() => setMode("register")}
              >
                <Text style={styles.modeText}>Registro normal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "bootstrap" && styles.modeBtnActive]}
                onPress={() => setMode("bootstrap")}
              >
                <Text style={styles.modeText}>Bootstrap admin</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nombre"
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholderTextColor="#8b6f4e"
            />
            <TextInput
              style={styles.input}
              placeholder="Usuario"
              value={form.username}
              onChangeText={(username) => setForm((prev) => ({ ...prev, username }))}
              autoCapitalize="none"
              placeholderTextColor="#8b6f4e"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={form.email}
              onChangeText={(email) => setForm((prev) => ({ ...prev, email }))}
              autoCapitalize="none"
              placeholderTextColor="#8b6f4e"
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              value={form.password}
              onChangeText={(password) => setForm((prev) => ({ ...prev, password }))}
              secureTextEntry
              placeholderTextColor="#8b6f4e"
            />

            {mode === "register" && (
              <View style={styles.roleRow}>
                {(["cashier", "manager", "admin"] as const).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleBtn, form.role === role && styles.roleBtnActive]}
                    onPress={() => setForm((prev) => ({ ...prev, role }))}
                  >
                    <Text style={styles.roleBtnText}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowUsersModal(false)}>
                <Text style={styles.secondaryBtnText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateUser} disabled={isSaving}>
                <Text style={styles.primaryBtnText}>{isSaving ? "Guardando..." : "Crear"}</Text>
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
    backgroundColor: "#1a0f0a",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f5f1e8",
    padding: 20,
  },
  card: {
    backgroundColor: "#2c1810",
    margin: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  name: {
    color: "#f5f1e8",
    fontSize: 20,
    fontWeight: "bold",
  },
  role: {
    color: "#d4a574",
    marginTop: 5,
  },
  logoutButton: {
    backgroundColor: "#c0392b",
    margin: 15,
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  usersButton: {
    backgroundColor: "#2c1810",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  usersButtonText: {
    color: "#d4a574",
    fontWeight: "bold",
  },
  info: {
    alignItems: "center",
    marginTop: 20,
  },
  version: {
    color: "#8b6f4e",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#1a0f0a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  modalTitle: {
    color: "#f5f1e8",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#2c1810",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f5f1e8",
    borderWidth: 1,
    borderColor: "#4a3428",
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#3a2a20",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#f5f1e8",
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#d4a574",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#1a0f0a",
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: "#2c1810",
    borderColor: "#4a3428",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  modeBtnActive: {
    borderColor: "#d4a574",
  },
  modeText: {
    color: "#f5f1e8",
    fontSize: 12,
    fontWeight: "600",
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4a3428",
    backgroundColor: "#2c1810",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  roleBtnActive: {
    borderColor: "#d4a574",
    backgroundColor: "#4a3428",
  },
  roleBtnText: {
    color: "#f5f1e8",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default SettingsScreen;
