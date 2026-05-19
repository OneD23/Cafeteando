import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { addJournalEntry } from '../store/accountingSlice';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export const ReportsScreen: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [accountingTab, setAccountingTab] = useState<'reportes' | 'factura' | 'movimientos' | 'diario' | 'apertura' | 'gastos'>('reportes');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [dgiiResult, setDgiiResult] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const { ingredients, movements } = useSelector((state: any) => state.inventory);
  const { products } = useSelector((state: any) => state.recipes);
  const { entries } = useSelector((state: any) => state.accounting);
  const dispatch = useDispatch();


  const getStartDate = (selected: 'day' | 'week' | 'month') => {
    const now = new Date();
    if (selected === 'day') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (selected === 'week') {
      const weekday = now.getDay();
      const diff = weekday === 0 ? 6 : weekday - 1;
      const start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const periodStart = useMemo(() => getStartDate(period), [period]);

  const filteredMovements = useMemo(
    () => movements.filter((mov: any) => new Date(mov.date) >= periodStart),
    [movements, periodStart]
  );

  const filteredEntries = useMemo(
    () => entries.filter((entry: any) => new Date(entry.date) >= periodStart),
    [entries, periodStart]
  );

  // Calcular métricas
  const totalInventoryValue = ingredients.reduce((sum: number, ing: any) => 
    sum + (ing.stock * ing.costPerUnit), 0
  );

  const lowStockCount = ingredients.filter((ing: any) => 
    ing.stock <= ing.minStock
  ).length;

  const totalMovements = filteredMovements.length;
  const totalEntries = filteredEntries
    .filter((e: any) => e.direction === 'in')
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalExits = filteredEntries
    .filter((e: any) => e.direction === 'out')
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  const netResult = totalEntries - totalExits;

  const totalExpenses = filteredEntries
    .filter((e: any) => e.direction === 'out' && e.description?.toLowerCase()?.includes('gasto operativo'))
    .reduce((sum: number, e: any) => sum + e.amount, 0);

  const stats = [
    { 
      label: 'Valor Inventario', 
      value: `$${totalInventoryValue.toFixed(2)}`,
      icon: 'cash-outline',
      color: '#27ae60'
    },
    { 
      label: 'Productos', 
      value: products.length.toString(),
      icon: 'cafe-outline',
      color: '#d4a574'
    },
    { 
      label: 'Ingredientes', 
      value: ingredients.length.toString(),
      icon: 'cube-outline',
      color: '#3498db'
    },
    { 
      label: 'Stock Bajo', 
      value: lowStockCount.toString(),
      icon: 'warning-outline',
      color: lowStockCount > 0 ? '#c0392b' : '#27ae60'
    },
    { 
      label: 'Movimientos', 
      value: totalMovements.toString(),
      icon: 'swap-vertical-outline',
      color: '#9b59b6'
    },
    { 
      label: 'Entradas', 
      value: `$${totalEntries.toFixed(2)}`,
      icon: 'arrow-down-circle-outline',
      color: '#27ae60'
    },
    { 
      label: 'Salidas', 
      value: `$${totalExits.toFixed(2)}`,
      icon: 'arrow-up-circle-outline',
      color: '#c0392b'
    },
    { 
      label: 'Gastos', 
      value: `$${totalExpenses.toFixed(2)}`,
      icon: 'receipt-outline',
      color: '#e67e22'
    },
    { 
      label: 'Resultado', 
      value: `$${netResult.toFixed(2)}`,
      icon: 'trending-up-outline',
      color: netResult >= 0 ? '#27ae60' : '#c0392b'
    },
  ];

  const recentMovements = filteredMovements.slice(-10).reverse();
  const recentJournal = [...filteredEntries].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  const latestSaleEntry = filteredEntries.find((e: any) => e.category === 'sale');

  React.useEffect(() => {
    const loadCashState = async () => {
      const response = await api.getCashSession();
      const cs = response?.data;
      if (cs?.isOpen) {
        setOpenedAt(cs.openedAt);
        setOpeningAmount(String(cs.openingAmount || '0'));
      }
    };
    loadCashState();
  }, []);


  const exportReportToPdf = async (reportName: string, rows: Array<{ label: string; value: string }>) => {
    try {
      const generatedAt = new Date();
      const html = `
        <html>
          <body style="font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #1a0f0a;">
            <h1 style="margin-bottom: 4px;">Cafeteando · ${reportName}</h1>
            <p style="margin-top: 0; color: #555;">Generado: ${generatedAt.toLocaleString()}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              ${rows
                .map((row) => `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600;">${row.label}</td><td style="border:1px solid #ddd;padding:8px;">${row.value}</td></tr>`)
                .join('')}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Guardar ${reportName}` });
      } else {
        Alert.alert('PDF generado', `Se guardó en: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar el PDF del reporte.');
    }
  };

  React.useEffect(() => {
    const loadInvoices = async () => {
      const raw = await AsyncStorage.getItem('cafetrack_sales_history');
      const rows = raw ? JSON.parse(raw) : [];
      setInvoices(rows);
    };
    if (accountingTab === 'factura') loadInvoices();
  }, [accountingTab, entries.length]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🏦 Contabilidad</Text>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['day', 'week', 'month'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.subTabs}>
        {(['reportes','factura','movimientos','diario','apertura','gastos'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.subTab, accountingTab === tab && styles.subTabActive]} onPress={() => setAccountingTab(tab)}>
            <Text style={[styles.subTabText, accountingTab === tab && styles.subTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {accountingTab === 'apertura' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Apertura de Caja</Text>
          <Text style={styles.movementDetail}>Registra la apertura para iniciar operaciones.</Text>
          <View style={styles.aperturaRow}><Text style={styles.movementTitle}>Estado:</Text><Text style={[styles.movementQty, { color: openedAt ? '#27ae60' : '#d4a574' }]}>{openedAt ? 'ABIERTA' : 'PENDIENTE'}</Text></View>
          <View style={styles.aperturaRow}><Text style={styles.movementTitle}>Monto inicial:</Text><Text style={styles.movementTitle}>${openingAmount}</Text></View>
          <TextInput value={openingAmount} onChangeText={setOpeningAmount} keyboardType='decimal-pad' style={styles.input} placeholder='Monto apertura' placeholderTextColor='#8b6f4e' />
          <TouchableOpacity style={styles.actionBtn} onPress={async () => {
            await api.openCashSession(Number(openingAmount || 0));
            setOpenedAt(new Date().toISOString());
            Alert.alert('Listo', 'Apertura registrada');
          }}><Text style={styles.actionBtnText}>Registrar Apertura</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => exportReportToPdf('Cierre de caja', [
            { label: 'Monto apertura', value: `$${Number(openingAmount || 0).toFixed(2)}` },
            { label: 'Ingresos', value: `$${totalEntries.toFixed(2)}` },
            { label: 'Salidas', value: `$${totalExits.toFixed(2)}` },
            { label: 'Gastos', value: `$${totalExpenses.toFixed(2)}` },
            { label: 'Resultado', value: `$${netResult.toFixed(2)}` },
          ])}><Text style={styles.actionBtnText}>Guardar PDF Cierre Caja</Text></TouchableOpacity>
          {openedAt ? <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#c0392b' }]} onPress={async () => {
            const report = {
              date: new Date().toISOString(),
              openingAmount: Number(openingAmount || 0),
              ingresos: totalEntries,
              salidas: totalExits,
              gastos: totalExpenses,
              resultado: netResult,
            };
            await AsyncStorage.setItem('cash_close_report', JSON.stringify(report));
            await api.closeCashSession();
            setOpenedAt(null);
            Alert.alert('Cierre realizado', `Resultado del día: $${netResult.toFixed(2)}`);
          }}><Text style={[styles.actionBtnText, { color: '#fff' }]}>Cerrar Caja y Generar Reporte</Text></TouchableOpacity> : null}
        </View>
      )}
      {accountingTab === 'reportes' && (
      <>
      <TouchableOpacity style={[styles.actionBtn, { marginHorizontal: 15 }]} onPress={() => exportReportToPdf('Reporte general', [
        { label: 'Valor inventario', value: `$${totalInventoryValue.toFixed(2)}` },
        { label: 'Movimientos', value: String(totalMovements) },
        { label: 'Entradas', value: `$${totalEntries.toFixed(2)}` },
        { label: 'Salidas', value: `$${totalExits.toFixed(2)}` },
        { label: 'Gastos', value: `$${totalExpenses.toFixed(2)}` },
        { label: 'Resultado', value: `$${netResult.toFixed(2)}` },
      ])}>
        <Text style={styles.actionBtnText}>Guardar PDF Reporte General</Text>
      </TouchableOpacity>
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
              <Ionicons name={stat.icon as any} size={24} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <View style={styles.alertCard}>
          <Ionicons name="alert-circle" size={24} color="#c0392b" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ Alerta de Stock Bajo</Text>
            <Text style={styles.alertText}>
              {lowStockCount} ingrediente{lowStockCount > 1 ? 's' : ''} necesita{lowStockCount === 1 ? '' : 'n'} reposición
            </Text>
          </View>
        </View>
      )}
      </>
      )}

      {(accountingTab === 'movimientos' || accountingTab === 'reportes') && (
      <>
      <Text style={styles.sectionTitle}>📋 Movimientos Recientes</Text>
      <View style={styles.sectionCard}>
        {recentMovements.length === 0 ? (
          <Text style={styles.emptyText}>No hay movimientos registrados</Text>
        ) : (
          recentMovements.map((mov: any) => {
            const ing = ingredients.find((i: any) => i.id === mov.ingredientId);
            return (
              <View key={mov.id} style={styles.movementItem}>
                <View style={styles.movementIcon}>
                  <Ionicons 
                    name={mov.type === 'sale' ? 'cart-outline' : mov.type === 'restock' ? 'add-circle-outline' : 'sync-outline'} 
                    size={20} 
                    color={mov.quantity < 0 ? '#c0392b' : '#27ae60'} 
                  />
                </View>
                <View style={styles.movementInfo}>
                  <Text style={styles.movementTitle}>{ing?.name || 'Desconocido'}</Text>
                  <Text style={styles.movementDetail}>{mov.reason}</Text>
                  <Text style={styles.movementDate}>
                    {new Date(mov.date).toLocaleString()}
                  </Text>
                </View>
                <Text style={[
                  styles.movementQty,
                  { color: mov.quantity < 0 ? '#c0392b' : '#27ae60' }
                ]}>
                  {mov.quantity > 0 ? '+' : ''}{mov.quantity} {ing?.unit}
                </Text>
              </View>
            );
          }).slice(0,6)
        )}
      </View>
      </>
      )}

      {(accountingTab === 'diario' || accountingTab === 'reportes') && (
      <>
      <Text style={styles.sectionTitle}>📒 Diario Contable</Text>
      <View style={styles.sectionCard}>
        {recentJournal.length === 0 ? (
          <Text style={styles.emptyText}>No hay asientos contables registrados</Text>
        ) : (
          recentJournal.map((entry: any) => (
            <View key={entry.id} style={styles.movementItem}>
              <View style={styles.movementIcon}>
                <Ionicons
                  name={entry.direction === 'in' ? 'trending-down-outline' : 'trending-up-outline'}
                  size={20}
                  color={entry.direction === 'in' ? '#27ae60' : '#c0392b'}
                />
              </View>
              <View style={styles.movementInfo}>
                <Text style={styles.movementTitle}>{entry.description}</Text>
                <Text style={styles.movementDetail}>{entry.category}</Text>
                <Text style={styles.movementDate}>{new Date(entry.date).toLocaleString()}</Text>
              </View>
              <Text
                style={[
                  styles.movementQty,
                  { color: entry.direction === 'in' ? '#27ae60' : '#c0392b' }
                ]}
              >
                {entry.direction === 'in' ? '+' : '-'}${entry.amount.toFixed(2)}
              </Text>
            </View>
          )).slice(0,6)
        )}
      </View>
      </>
      )}

      {accountingTab === 'gastos' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>💸 Registro de Gastos</Text>
          <Text style={styles.movementDetail}>Registra gastos operativos diarios como hielo, vasos, servilletas u otros insumos.</Text>
          <TextInput
            value={expenseName}
            onChangeText={setExpenseName}
            style={styles.input}
            placeholder='Descripción del gasto (ej. Hielo)'
            placeholderTextColor='#8b6f4e'
          />
          <TextInput
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            keyboardType='decimal-pad'
            style={styles.input}
            placeholder='Monto del gasto'
            placeholderTextColor='#8b6f4e'
          />
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              const name = expenseName.trim();
              const amount = Number(expenseAmount);

              if (!name) return Alert.alert('Dato requerido', 'Ingresa una descripción del gasto.');
              if (!Number.isFinite(amount) || amount <= 0) return Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');

              dispatch(addJournalEntry({
                direction: 'out',
                category: 'other',
                description: `Gasto operativo: ${name}`,
                amount,
                reference: 'manual-expense',
              }));

              setExpenseName('');
              setExpenseAmount('');
              Alert.alert('Gasto registrado', `Se registró $${amount.toFixed(2)} en ${name}.`);
            }}
          >
            <Text style={styles.actionBtnText}>Guardar gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => exportReportToPdf('Reporte de gastos', [
            { label: 'Gastos del período', value: `$${totalExpenses.toFixed(2)}` },
            { label: 'Salidas totales', value: `$${totalExits.toFixed(2)}` },
            { label: 'Resultado neto', value: `$${netResult.toFixed(2)}` },
          ])}>
            <Text style={styles.actionBtnText}>Guardar PDF de Gastos</Text>
          </TouchableOpacity>
        </View>
      )}

      {accountingTab === 'factura' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🧾 Facturación</Text>
          <Text style={styles.movementDetail}>Resumen ejecutivo para emisión rápida de comprobantes.</Text>
          <View style={styles.aperturaRow}><Text style={styles.movementTitle}>Ventas registradas:</Text><Text style={styles.movementTitle}>{filteredEntries.length}</Text></View>
          <View style={styles.aperturaRow}><Text style={styles.movementTitle}>Ingresos:</Text><Text style={[styles.movementQty,{color:'#27ae60'}]}>${totalEntries.toFixed(2)}</Text></View>
          <View style={styles.aperturaRow}><Text style={styles.movementTitle}>Impuestos estimados:</Text><Text style={styles.movementTitle}>${(totalEntries*0.16).toFixed(2)}</Text></View>
          <TouchableOpacity style={styles.actionBtn} onPress={async () => {
            if (!latestSaleEntry?.meta?.saleId) return Alert.alert('Sin venta', 'No hay venta con saleId para facturar.');
            const generated = await api.generateDgiiEcf({ saleId: latestSaleEntry.meta.saleId, ncfType: 'B02' });
            const sent = await api.sendDgiiEcf(generated.data);
            setDgiiResult(sent.data);
            Alert.alert('DGII', 'e-CF generado y enviado en modo integración inicial');
          }}>
            <Text style={styles.actionBtnText}>Generar e-CF DGII (sandbox)</Text>
          </TouchableOpacity>
          {dgiiResult?.secuencia ? <Text style={styles.movementDetail}>NCF: {dgiiResult.secuencia} · Estado: {dgiiResult.estado}</Text> : null}
          <Text style={[styles.sectionTitle, { fontSize: 16, paddingHorizontal: 0, marginTop: 14 }]}>Facturas emitidas</Text>
          {invoices.length === 0 ? <Text style={styles.emptyText}>No hay facturas registradas todavía.</Text> : invoices.slice(0, 20).map((inv: any) => (
            <View key={`${inv.saleId}-${inv.date}`} style={styles.invoiceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.movementTitle}>Factura #{inv.saleId || 'N/A'}</Text>
                <Text style={styles.movementDetail}>Cliente: {inv.customerName || 'Consumidor Final'}</Text>
                <Text style={styles.movementDate}>Fecha: {new Date(inv.date).toLocaleDateString()} · Hora: {new Date(inv.date).toLocaleTimeString()}</Text>
              </View>
              <Text style={[styles.movementQty, { color: '#27ae60' }]}>${Number(inv.total || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f0a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f5f1e8',
    padding: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: '#2c1810',
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  periodBtnActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  periodText: {
    color: '#8b6f4e',
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#1a0f0a',
  },
  subTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  subTab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4a3428',
    backgroundColor: '#2c1810',
  },
  subTabActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  subTabText: { color: '#f5f1e8', textTransform: 'capitalize', fontWeight: '600' },
  subTabTextActive: { color: '#1a0f0a' },
  input: {
    backgroundColor: '#2c1810',
    borderColor: '#4a3428',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f5f1e8',
    marginTop: 10,
  },
  actionBtn: {
    marginTop: 10,
    backgroundColor: '#d4a574',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#1a0f0a', fontWeight: '800' },
  content: {
    paddingBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  statCard: {
    width: (width - 50) / 2,
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 15,
    margin: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    color: '#f5f1e8',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#8b6f4e',
    fontSize: 12,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192, 57, 43, 0.1)',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c0392b',
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: '#c0392b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  alertText: {
    color: '#f5f1e8',
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionCard: {
    marginHorizontal: 15,
    backgroundColor: '#24160f',
    borderWidth: 1,
    borderColor: '#4a3428',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  aperturaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  invoiceRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#3a2a20',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#8b6f4e',
    textAlign: 'center',
    marginTop: 20,
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c1810',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  movementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a0f0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  movementInfo: {
    flex: 1,
  },
  movementTitle: {
    color: '#f5f1e8',
    fontWeight: '600',
  },
  movementDetail: {
    color: '#8b6f4e',
    fontSize: 12,
    marginTop: 2,
  },
  movementDate: {
    color: '#8b6f4e',
    fontSize: 10,
    marginTop: 2,
  },
  movementQty: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default ReportsScreen;
