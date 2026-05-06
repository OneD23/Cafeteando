import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
    StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../store/authSlice";
import api from "../api/client";

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state: any) => state.auth);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
  });

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Por favor ingresa usuario y contraseña");
      return;
    }

    try {
      await dispatch(loginUser({ username, password }) as any);
    } catch {
      Alert.alert("Error", "Credenciales inválidas");
    }
  };

  const handleBootstrapAdmin = async () => {
    const { username, email, name, password } = bootstrapForm;

    if (!username || !email || !name || !password) {
      Alert.alert("Datos incompletos", "Completa todos los campos para crear el admin");
      return;
    }

    try {
      setCreatingAdmin(true);
      await api.bootstrapAdmin(bootstrapForm);
      Alert.alert("Éxito", "Admin inicial creado. Ya puedes iniciar sesión.");
      setShowBootstrapModal(false);
      setBootstrapForm({
        username: "",
        email: "",
        name: "",
        password: "",
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No fue posible crear el admin inicial");
    } finally {
      setCreatingAdmin(false);
    }
  };

  

  

  const onBootstrapAdmin = async () => {
    if (!bootstrapForm.username || !bootstrapForm.email || !bootstrapForm.name || !bootstrapForm.password) {
      Alert.alert('Datos incompletos', 'Completa todos los campos para crear el admin');
      return;
    }

    try {
      setCreatingAdmin(true);
      await api.bootstrapAdmin(bootstrapForm);
      Alert.alert('Éxito', 'Admin inicial creado. Ya puedes iniciar sesión.');
      setShowBootstrapModal(false);
      setBootstrapForm({ username: '', email: '', name: '', password: '' });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No fue posible crear el admin inicial');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0f0a" />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>☕</Text>
          <Text style={styles.logoTitle}>CafeTrack</Text>
          <Text style={styles.logoSubtitle}>MOBILE POS</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            placeholderTextColor="#8b6f4e"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#8b6f4e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#1a0f0a" />
            ) : (
              <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>Usa tus credenciales del backend</Text>

          <TouchableOpacity onPress={() => setShowBootstrapModal(true)}>
            <Text style={styles.bootstrapLink}>Configurar primer usuario</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showBootstrapModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear admin inicial</Text>
            <Text style={styles.modalDescription}>
              Este formulario solo funcionará si no existen usuarios en el sistema.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Nombre"
              placeholderTextColor="#8b6f4e"
              value={bootstrapForm.name}
              onChangeText={(name) =>
                setBootstrapForm((prev) => ({ ...prev, name }))
              }
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Usuario"
              placeholderTextColor="#8b6f4e"
              value={bootstrapForm.username}
              onChangeText={(value) =>
                setBootstrapForm((prev) => ({ ...prev, username: value }))
              }
              autoCapitalize="none"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Email"
              placeholderTextColor="#8b6f4e"
              value={bootstrapForm.email}
              onChangeText={(value) =>
                setBootstrapForm((prev) => ({ ...prev, email: value }))
              }
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Contraseña"
              placeholderTextColor="#8b6f4e"
              value={bootstrapForm.password}
              onChangeText={(value) =>
                setBootstrapForm((prev) => ({ ...prev, password: value }))
              }
              secureTextEntry
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowBootstrapModal(false)}
                disabled={creatingAdmin}
              >
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, creatingAdmin && styles.buttonDisabled]}
                onPress={handleBootstrapAdmin}
                disabled={creatingAdmin}
              >
                <Text style={styles.confirmBtnText}>
                  {creatingAdmin ? "Creando..." : "Crear admin"}
                </Text>
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
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 10,
  },
  logoTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#f5f1e8",
  },
  logoSubtitle: {
    fontSize: 18,
    color: "#d4a574",
    letterSpacing: 3,
  },
  form: {
    width: "100%",
  },
  input: {
    backgroundColor: "#2c1810",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    color: "#f5f1e8",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  button: {
    backgroundColor: "#d4a574",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#1a0f0a",
    fontSize: 18,
    fontWeight: "bold",
  },
  hint: {
    color: "#8b6f4e",
    textAlign: "center",
    marginTop: 20,
    fontSize: 12,
  },
  bootstrapLink: {
    color: "#d4a574",
    textAlign: "center",
    marginTop: 12,
    textDecorationLine: "underline",
    fontSize: 13,
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
    marginBottom: 12,
  },
  modalDescription: {
    color: "#d8c6b2",
    marginBottom: 12,
    fontSize: 13,
  },
  modalInput: {
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
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#3a2a20",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#f5f1e8",
    fontWeight: "700",
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#d4a574",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#1a0f0a",
    fontWeight: "700",
  },
});

export default LoginScreen;
