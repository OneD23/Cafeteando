import React, { useState } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../store/authSlice';
import api from '../api/client';

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state: any) => state.auth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState({ username: '', email: '', name: '', password: '' });

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Por favor ingresa usuario y contraseña');
      return;
    }

    try {
      await dispatch(loginUser({ username, password }) as any);
    } catch {
      Alert.alert('Error', 'Credenciales inválidas');
    }
  };

  const handleBootstrapAdmin = async () => {
    const { username, email, name, password } = bootstrapForm;

    if (!username || !email || !name || !password) {
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
      <View style={styles.backgroundGlow} />

      <View style={styles.shell}>
        <View style={styles.heroPanel}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>C</Text>
          </View>
          <Text style={styles.eyebrow}>Cafeteando Operations Suite</Text>
          <Text style={styles.heroTitle}>Punto de venta y control operativo para cafeterías.</Text>
          <Text style={styles.heroCopy}>
            Ventas, caja, inventario, producción y reportes contables en una experiencia pensada para operación real.
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>POS</Text>
              <Text style={styles.metricLabel}>Ventas rápidas</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>Caja</Text>
              <Text style={styles.metricLabel}>Apertura y cierre</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>Stock</Text>
              <Text style={styles.metricLabel}>Recetas e insumos</Text>
            </View>
          </View>
        </View>

        <View style={styles.loginCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>
            <Text style={styles.cardSubtitle}>Accede al panel de Cafeteando</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Usuario</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={18} color="#8b6f4e" />
              <TextInput
                style={styles.input}
                placeholder="usuario@cafeteando"
                placeholderTextColor="#8b6f4e"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contraseña</Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={18} color="#8b6f4e" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#8b6f4e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#1a0f0a" /> : <Text style={styles.buttonText}>Entrar al sistema</Text>}
          </TouchableOpacity>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.bootstrapButton} onPress={() => setShowBootstrapModal(true)}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#d4a574" />
            <Text style={styles.bootstrapLink}>Configurar primer administrador</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showBootstrapModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear admin inicial</Text>
            <Text style={styles.modalDescription}>Este formulario solo funcionará si no existen usuarios en el sistema.</Text>

            {(['name', 'username', 'email', 'password'] as const).map((field) => (
              <TextInput
                key={field}
                style={styles.modalInput}
                placeholder={{ name: 'Nombre', username: 'Usuario', email: 'Email', password: 'Contraseña' }[field]}
                placeholderTextColor="#8b6f4e"
                value={bootstrapForm[field]}
                onChangeText={(value) => setBootstrapForm((prev) => ({ ...prev, [field]: value }))}
                autoCapitalize="none"
                keyboardType={field === 'email' ? 'email-address' : 'default'}
                secureTextEntry={field === 'password'}
              />
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBootstrapModal(false)} disabled={creatingAdmin}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.confirmBtn, creatingAdmin && styles.buttonDisabled]} onPress={handleBootstrapAdmin} disabled={creatingAdmin}>
                <Text style={styles.confirmBtnText}>{creatingAdmin ? 'Creando...' : 'Crear admin'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0f0a' },
  backgroundGlow: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(212,165,116,0.16)',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    padding: Platform.OS === 'web' ? 40 : 22,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  heroPanel: { flex: 1, maxWidth: 610 },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#d4a574',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#d4a574',
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  brandMarkText: { color: '#1a0f0a', fontSize: 28, fontWeight: '900' },
  eyebrow: { color: '#d4a574', fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#f5f1e8', fontSize: Platform.OS === 'web' ? 48 : 34, lineHeight: Platform.OS === 'web' ? 56 : 40, fontWeight: '900', marginTop: 12 },
  heroCopy: { color: '#d8c6b2', fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 560 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  metricCard: { minWidth: 142, padding: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(212,165,116,0.20)' },
  metricValue: { color: '#f5f1e8', fontSize: 18, fontWeight: '900' },
  metricLabel: { color: '#8b6f4e', fontSize: 12, marginTop: 4 },
  loginCard: { width: '100%', maxWidth: 430, padding: 26, borderRadius: 28, backgroundColor: '#2c1810', borderWidth: 1, borderColor: 'rgba(212,165,116,0.24)', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 18 },
  cardHeader: { marginBottom: 22 },
  cardTitle: { color: '#f5f1e8', fontSize: 28, fontWeight: '900' },
  cardSubtitle: { color: '#8b6f4e', marginTop: 6 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#d8c6b2', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  inputShell: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a0f0a', borderRadius: 16, borderWidth: 1, borderColor: '#4a3428', paddingHorizontal: 14 },
  input: { flex: 1, color: '#f5f1e8', fontSize: 16, paddingVertical: 15 },
  button: { backgroundColor: '#d4a574', borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#1a0f0a', fontSize: 16, fontWeight: '900' },
  divider: { height: 1, backgroundColor: 'rgba(212,165,116,0.18)', marginVertical: 20 },
  bootstrapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bootstrapLink: { color: '#d4a574', fontSize: 14, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,7,18,0.78)', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: '#2c1810', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: 'rgba(212,165,116,0.24)' },
  modalTitle: { color: '#f5f1e8', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  modalDescription: { color: '#8b6f4e', marginBottom: 16, fontSize: 13, lineHeight: 19 },
  modalInput: { backgroundColor: '#1a0f0a', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: '#f5f1e8', borderWidth: 1, borderColor: '#4a3428', marginBottom: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#3a2a20', borderRadius: 14, padding: 13, alignItems: 'center' },
  cancelBtnText: { color: '#f5f1e8', fontWeight: '800' },
  confirmBtn: { flex: 1, backgroundColor: '#d4a574', borderRadius: 14, padding: 13, alignItems: 'center' },
  confirmBtnText: { color: '#1a0f0a', fontWeight: '900' },
});

export default LoginScreen;
