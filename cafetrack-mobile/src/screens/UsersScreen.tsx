import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UsersScreen: React.FC = () => {
  const { user } = useSelector((state: any) => state.auth);
  const [mode, setMode] = useState<'bootstrap' | 'register'>('register');
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<'empleados'|'clientes'>('empleados');
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', role: 'cashier' as 'admin' | 'manager' | 'cashier' });
  const [clients, setClients] = useState<any[]>([]);
  const [clientForm, setClientForm] = useState({ id: '', name: '', phone: '', email: '' });

  const handleCreateUser = async () => {
    if (user?.role !== 'admin') return Alert.alert('Acceso denegado', 'Solo administradores pueden gestionar usuarios.');
    if (!form.username || !form.email || !form.name || !form.password) return Alert.alert('Datos incompletos', 'Completa todos los campos.');
    try {
      setIsSaving(true);
      if (mode === 'bootstrap') await api.bootstrapAdmin({ username: form.username, email: form.email, name: form.name, password: form.password });
      else await api.registerUser(form);
      Alert.alert('Éxito', 'Usuario creado correctamente.');
      setForm({ username: '', email: '', name: '', password: '', role: 'cashier' });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No fue posible crear el usuario.');
    } finally { setIsSaving(false); }
  };
  const loadClients = async () => {
    const raw = await AsyncStorage.getItem('cafetrack_clients');
    setClients(raw ? JSON.parse(raw) : []);
  };
  React.useEffect(() => { if (tab === 'clientes') loadClients(); }, [tab]);
  const saveClient = async () => {
    if (!clientForm.name.trim()) return Alert.alert('Nombre requerido');
    const next = [{ ...clientForm, id: clientForm.id || `cli-${Date.now()}` }, ...clients.filter((c) => c.id !== clientForm.id)];
    setClients(next);
    await AsyncStorage.setItem('cafetrack_clients', JSON.stringify(next));
    setClientForm({ id: '', name: '', phone: '', email: '' });
  };

  return <SafeAreaView style={styles.container}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>👥 Usuarios</Text>
    <Text style={styles.subtitle}>Módulo profesional de altas y control de cuentas.</Text>
    <View style={styles.switchRow}><TouchableOpacity style={[styles.modeBtn, tab==='empleados'&&styles.modeBtnActive]} onPress={()=>setTab('empleados')}><Text style={styles.modeText}>Empleados</Text></TouchableOpacity><TouchableOpacity style={[styles.modeBtn, tab==='clientes'&&styles.modeBtnActive]} onPress={()=>setTab('clientes')}><Text style={styles.modeText}>Clientes</Text></TouchableOpacity></View>
    {tab==='empleados' ? <>
    <View style={styles.switchRow}>{(['register','bootstrap'] as const).map((m)=><TouchableOpacity key={m} style={[styles.modeBtn, mode===m && styles.modeBtnActive]} onPress={()=>setMode(m)}><Text style={styles.modeText}>{m==='register'?'Registro':'Bootstrap'}</Text></TouchableOpacity>)}</View>
    <TextInput style={styles.input} placeholder='Nombre' value={form.name} onChangeText={(name)=>setForm((p)=>({...p,name}))} placeholderTextColor='#8b6f4e'/>
    <TextInput style={styles.input} placeholder='Usuario' value={form.username} onChangeText={(username)=>setForm((p)=>({...p,username}))} placeholderTextColor='#8b6f4e'/>
    <TextInput style={styles.input} placeholder='Email' value={form.email} onChangeText={(email)=>setForm((p)=>({...p,email}))} placeholderTextColor='#8b6f4e'/>
    <TextInput style={styles.input} placeholder='Contraseña' secureTextEntry value={form.password} onChangeText={(password)=>setForm((p)=>({...p,password}))} placeholderTextColor='#8b6f4e'/>
    {mode==='register' && <View style={styles.switchRow}>{(['cashier','manager','admin'] as const).map((r)=><TouchableOpacity key={r} style={[styles.modeBtn, form.role===r && styles.modeBtnActive]} onPress={()=>setForm((p)=>({...p,role:r}))}><Text style={styles.modeText}>{r}</Text></TouchableOpacity>)}</View>}
    <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateUser} disabled={isSaving}><Text style={styles.primaryText}>{isSaving?'Guardando...':'Crear Usuario'}</Text></TouchableOpacity>
    </> : <>
    <TextInput style={styles.input} placeholder='Nombre cliente' value={clientForm.name} onChangeText={(name)=>setClientForm((p)=>({...p,name}))} placeholderTextColor='#8b6f4e'/>
    <TextInput style={styles.input} placeholder='Teléfono' value={clientForm.phone} onChangeText={(phone)=>setClientForm((p)=>({...p,phone}))} placeholderTextColor='#8b6f4e'/>
    <TextInput style={styles.input} placeholder='Email' value={clientForm.email} onChangeText={(email)=>setClientForm((p)=>({...p,email}))} placeholderTextColor='#8b6f4e'/>
    <TouchableOpacity style={styles.primaryBtn} onPress={saveClient}><Text style={styles.primaryText}>Guardar Cliente</Text></TouchableOpacity>
    {clients.map((c)=> <TouchableOpacity key={c.id} style={styles.input} onPress={()=>setClientForm(c)}><Text style={styles.modeText}>{c.name} · {c.phone || c.email || 'Sin contacto'}</Text></TouchableOpacity>)}
    </>}
  </ScrollView></SafeAreaView>;
};

const styles = StyleSheet.create({container:{flex:1,backgroundColor:'#1a0f0a'},content:{padding:16},title:{color:'#f5f1e8',fontSize:28,fontWeight:'800'},subtitle:{color:'#8b6f4e',marginVertical:8},input:{backgroundColor:'#2c1810',borderRadius:10,padding:12,color:'#f5f1e8',borderWidth:1,borderColor:'#4a3428',marginBottom:10},switchRow:{flexDirection:'row',gap:8,marginBottom:10},modeBtn:{flex:1,padding:10,borderRadius:10,borderWidth:1,borderColor:'#4a3428',backgroundColor:'#2c1810'},modeBtnActive:{backgroundColor:'#d4a574'},modeText:{textAlign:'center',color:'#f5f1e8',fontWeight:'700',textTransform:'capitalize'},primaryBtn:{backgroundColor:'#d4a574',padding:14,borderRadius:12,marginTop:10,alignItems:'center'},primaryText:{color:'#1a0f0a',fontWeight:'800'}});

export default UsersScreen;
