import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueUnsynced } from '../services/localDb';

const UsersScreen: React.FC = () => {
  const { user } = useSelector((state: any) => state.auth);
  const [mode, setMode] = useState<'bootstrap' | 'register'>('register');
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<'empleados'|'clientes'>('empleados');
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', role: 'cashier' as 'admin' | 'manager' | 'cashier' });
  const [clients, setClients] = useState<any[]>([]);
  const [clientForm, setClientForm] = useState({ id: '', name: '', phone: '', email: '', taxId: '', address: '', creditLimit: '', creditActive: '' });
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const handleCreateUser = async () => {
    if (user?.role !== 'admin') return Alert.alert('Acceso denegado', 'Solo administradores pueden gestionar usuarios.');
    if (!form.username || !form.email || !form.name || !form.password) return Alert.alert('Datos incompletos', 'Completa todos los campos.');
    try {
      setIsSaving(true);
      if (mode === 'bootstrap') await api.bootstrapAdmin({ username: form.username, email: form.email, name: form.name, password: form.password });
      else await api.registerUser(form);
      await queueUnsynced('employee', { ...form, mode, unsynced: true });
      Alert.alert('Éxito', 'Usuario creado correctamente.');
      setForm({ username: '', email: '', name: '', password: '', role: 'cashier' });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No fue posible crear el usuario.');
    } finally { setIsSaving(false); }
  };

  const loadClients = async () => {
    const [raw, salesRaw] = await Promise.all([
      AsyncStorage.getItem('cafetrack_clients'),
      AsyncStorage.getItem('cafetrack_sales_history'),
    ]);
    const parsedClients = raw ? JSON.parse(raw) : [];
    setClients(parsedClients);
    setSalesHistory(salesRaw ? JSON.parse(salesRaw) : []);
    if (parsedClients.length && !selectedClientId) {
      setSelectedClientId(parsedClients[0].id);
      setClientForm({ ...parsedClients[0], taxId: parsedClients[0].taxId || '', address: parsedClients[0].address || '', creditLimit: parsedClients[0].creditLimit || '', creditActive: parsedClients[0].creditActive || '' });
    }
  };

  React.useEffect(() => { if (tab === 'clientes') loadClients(); }, [tab]);

  const saveClient = async () => {
    if (!clientForm.name.trim()) return Alert.alert('Nombre requerido');
    const entity = { ...clientForm, id: clientForm.id || `cli-${Date.now()}` };
    const next = [entity, ...clients.filter((c) => c.id !== entity.id)];
    setClients(next);
    setSelectedClientId(entity.id);
    await AsyncStorage.setItem('cafetrack_clients', JSON.stringify(next));
    await queueUnsynced('client', { ...entity, unsynced: true });
    Alert.alert('Guardado', 'Cliente guardado correctamente.');
  };

  const selectedClientInvoices = useMemo(() => {
    const selectedClient = clients.find((c) => c.id === selectedClientId);
    if (!selectedClient) return [];
    return salesHistory.filter((s: any) => String(s.customerName || '').trim().toLowerCase() === String(selectedClient.name || '').trim().toLowerCase());
  }, [clients, selectedClientId, salesHistory]);

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
      <View style={styles.clientsLayout}>
        <View style={styles.clientFormCard}>
          <Text style={styles.panelTitle}>Datos del cliente</Text>
          <TextInput style={styles.input} placeholder='Id' value={clientForm.id} onChangeText={(id)=>setClientForm((p)=>({...p,id}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Nombre' value={clientForm.name} onChangeText={(name)=>setClientForm((p)=>({...p,name}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Cédula o RNC' value={clientForm.taxId} onChangeText={(taxId)=>setClientForm((p)=>({...p,taxId}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Dirección' value={clientForm.address} onChangeText={(address)=>setClientForm((p)=>({...p,address}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Teléfono' value={clientForm.phone} onChangeText={(phone)=>setClientForm((p)=>({...p,phone}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Correo' value={clientForm.email} onChangeText={(email)=>setClientForm((p)=>({...p,email}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Límite de crédito' value={clientForm.creditLimit} onChangeText={(creditLimit)=>setClientForm((p)=>({...p,creditLimit}))} placeholderTextColor='#8b6f4e'/>
          <TextInput style={styles.input} placeholder='Crédito activo' value={clientForm.creditActive} onChangeText={(creditActive)=>setClientForm((p)=>({...p,creditActive}))} placeholderTextColor='#8b6f4e'/>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.dangerBtn} onPress={() => setClientForm({ id: '', name: '', phone: '', email: '', taxId: '', address: '', creditLimit: '', creditActive: '' })}><Text style={styles.dangerText}>Nuevo</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={saveClient}><Text style={styles.dangerText}>Guardar</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.clientListCard}>
          <Text style={styles.panelTitle}>Listado de clientes</Text>
          {clients.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.clientRow, selectedClientId === c.id && styles.clientRowActive]} onPress={() => { setSelectedClientId(c.id); setClientForm({ ...c, taxId: c.taxId || '', address: c.address || '', creditLimit: c.creditLimit || '', creditActive: c.creditActive || '' }); }}>
              <Text style={styles.clientCellId}>{c.id}</Text>
              <Text style={styles.clientCell}>{c.name}</Text>
              <Text style={styles.clientCell}>{c.phone || '-'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={styles.invoiceBtn} onPress={() => {
        if (!selectedClientInvoices.length) return Alert.alert('Sin facturas', 'Este cliente no tiene compras registradas.');
        setSelectedInvoice(selectedClientInvoices[0]);
      }}><Text style={styles.dangerText}>Lista de factura</Text></TouchableOpacity>
      <View style={styles.invoiceList}>
        {selectedClientInvoices.map((inv: any) => (
          <TouchableOpacity key={`${inv.saleId}-${inv.date}`} onPress={() => setSelectedInvoice(inv)}>
            <Text style={styles.invoiceItem}>#{inv.saleId} · {new Date(inv.date).toLocaleString()} · ${Number(inv.total || 0).toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>}
  </ScrollView>
  <Modal visible={!!selectedInvoice} transparent animationType='slide' onRequestClose={() => setSelectedInvoice(null)}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.title}>🧾 Factura</Text>
        <Text style={styles.subtitle}>#{selectedInvoice?.saleId || 'N/A'}</Text>
        <Text style={styles.subtitle}>Fecha: {selectedInvoice?.date ? new Date(selectedInvoice.date).toLocaleString() : '-'}</Text>
        <Text style={styles.subtitle}>Cliente: {selectedInvoice?.customerName || 'Consumidor final'}</Text>
        <Text style={[styles.subtitle, { color: '#27ae60' }]}>Total: ${Number(selectedInvoice?.total || 0).toFixed(2)}</Text>
        {(selectedInvoice?.items || []).map((item: any) => (<Text key={`${item.id}-${item.name}`} style={styles.subtitle}>{item.qty} x {item.name} · ${Number(item.price || 0).toFixed(2)}</Text>))}
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setSelectedInvoice(null)}><Text style={styles.primaryText}>Cerrar</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>
  </SafeAreaView>;
};

const styles = StyleSheet.create({container:{flex:1,backgroundColor:'#000'},content:{padding:16},title:{color:'#f5f1e8',fontSize:28,fontWeight:'800'},subtitle:{color:'#c7c7c7',marginVertical:4},input:{backgroundColor:'#1d1d1d',borderRadius:2,padding:10,color:'#fff',borderWidth:1,borderColor:'#777',marginBottom:8},switchRow:{flexDirection:'row',gap:8,marginBottom:10},modeBtn:{flex:1,padding:10,borderRadius:2,borderWidth:1,borderColor:'#444',backgroundColor:'#111'},modeBtnActive:{backgroundColor:'#d00'},modeText:{textAlign:'center',color:'#f5f5f5',fontWeight:'700',textTransform:'capitalize'},primaryBtn:{backgroundColor:'#d4a574',padding:14,borderRadius:8,marginTop:10,alignItems:'center'},primaryText:{color:'#1a0f0a',fontWeight:'800'},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',padding:20},modalCard:{backgroundColor:'#111',borderRadius:8,padding:16,borderWidth:1,borderColor:'#444'},clientsLayout:{flexDirection:'row',gap:16,alignItems:'flex-start',flexWrap:'wrap'},clientFormCard:{flex:1,minWidth:320,borderWidth:1,borderColor:'#777',padding:12},clientListCard:{flex:1,minWidth:320,borderWidth:1,borderColor:'#777',padding:12,minHeight:380},panelTitle:{color:'#fff',fontSize:16,fontWeight:'700',marginBottom:10},actionsGrid:{flexDirection:'row',gap:10,marginTop:8},dangerBtn:{backgroundColor:'#f00',paddingVertical:12,paddingHorizontal:18,borderRadius:2,alignItems:'center'},dangerText:{color:'#fff',fontWeight:'700'},clientRow:{flexDirection:'row',gap:8,paddingVertical:8,paddingHorizontal:6,borderBottomWidth:1,borderBottomColor:'#555'},clientRowActive:{backgroundColor:'#0066b3'},clientCellId:{color:'#fff',width:70},clientCell:{color:'#fff',flex:1},invoiceBtn:{backgroundColor:'#f00',marginTop:24,padding:16,alignSelf:'flex-start'},invoiceList:{marginTop:10,borderWidth:1,borderColor:'#444',padding:10},invoiceItem:{color:'#ddd',paddingVertical:5}});

export default UsersScreen;
