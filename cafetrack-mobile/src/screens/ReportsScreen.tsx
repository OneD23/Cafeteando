import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

type AccountingTab = 'dashboard' | 'facturas' | 'diario' | 'movimientos' | 'gastos' | 'caja' | 'reportes';

type Filters = {
  startDate: string;
  endDate: string;
  text: string;
  customer: string;
  cashier: string;
  paymentMethod: string;
  status: string;
  movementType: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const money = (value: any) => `$${Number(value || 0).toFixed(2)}`;
const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : 'N/D');
const emptyFilters = (): Filters => ({
  startDate: todayKey(),
  endDate: todayKey(),
  text: '',
  customer: '',
  cashier: '',
  paymentMethod: '',
  status: '',
  movementType: '',
});

const tabs: Array<{ key: AccountingTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'dashboard', label: 'KPIs', icon: 'speedometer-outline' },
  { key: 'facturas', label: 'Facturas', icon: 'receipt-outline' },
  { key: 'diario', label: 'Diario', icon: 'journal-outline' },
  { key: 'movimientos', label: 'Caja', icon: 'swap-horizontal-outline' },
  { key: 'gastos', label: 'Gastos', icon: 'card-outline' },
  { key: 'caja', label: 'Cierres', icon: 'lock-closed-outline' },
  { key: 'reportes', label: 'Reportes', icon: 'document-text-outline' },
];

const paymentMethods = [
  { label: 'Todos los pagos', value: '' },
  { label: 'Efectivo', value: 'cash' },
  { label: 'Tarjeta', value: 'card' },
  { label: 'Transferencia', value: 'transfer' },
  { label: 'Mixto', value: 'mixed' },
];

const invoiceStatuses = [
  { label: 'Todos los estados', value: '' },
  { label: 'Emitida', value: 'emitida' },
  { label: 'Anulada', value: 'anulada' },
  { label: 'Pendiente', value: 'pendiente' },
];

const movementTypes = ['', 'entrada', 'salida', 'venta', 'gasto', 'apertura', 'cierre', 'ajuste', 'anulación'];
const LOCAL_SALES_KEY = 'cafetrack_sales_history';
const LOCAL_EXPENSES_KEY = 'cafetrack_expenses_history';

const expenseCategories = ['hielo', 'vasos', 'servilletas', 'ingredientes', 'transporte', 'nómina', 'mantenimiento', 'otros'];


const dateInRange = (dateValue: string, startDate: string, endDate: string) => {
  const day = new Date(dateValue).toISOString().slice(0, 10);
  return day >= startDate && day <= endDate;
};


const storeLocalExpense = async (expense: any) => {
  const raw = await AsyncStorage.getItem(LOCAL_EXPENSES_KEY);
  const expenses = raw ? JSON.parse(raw) : [];
  const savedExpense = { ...expense, id: expense.id || `exp-${Date.now()}`, date: expense.date || new Date().toISOString() };
  expenses.unshift(savedExpense);
  await AsyncStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(expenses.slice(0, 500)));

  if (savedExpense.paymentMethod === 'cash') {
    const cashRaw = await AsyncStorage.getItem('cafetrack_cash_session');
    if (cashRaw) {
      const session = JSON.parse(cashRaw);
      if (session?.isOpen) {
        const summary = session.summary || { expectedCash: Number(session.openingAmount || 0), totals: { sales: 0 }, paymentMethods: [] };
        await AsyncStorage.setItem('cafetrack_cash_session', JSON.stringify({
          ...session,
          summary: {
            ...summary,
            expectedCash: Number(summary.expectedCash || session.openingAmount || 0) - Number(savedExpense.amount || 0),
            totals: { ...(summary.totals || {}), expenses: Number(summary.totals?.expenses || 0) + Number(savedExpense.amount || 0) },
          },
        }));
      }
    }
  }

  return savedExpense;
};

const buildLocalAccounting = async (filters: Filters) => {
  const [salesRaw, expensesRaw, cashRaw] = await Promise.all([
    AsyncStorage.getItem(LOCAL_SALES_KEY),
    AsyncStorage.getItem(LOCAL_EXPENSES_KEY),
    AsyncStorage.getItem('cafetrack_cash_session'),
  ]);
  const localSales = (salesRaw ? JSON.parse(salesRaw) : []).filter((sale: any) => dateInRange(sale.date, filters.startDate, filters.endDate));
  const localExpenses = (expensesRaw ? JSON.parse(expensesRaw) : []).filter((expense: any) => dateInRange(expense.date, filters.startDate, filters.endDate));
  const currentCash = cashRaw ? JSON.parse(cashRaw) : null;
  const salesTotal = localSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
  const expensesTotal = localExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);
  const productsSold = localSales.reduce((sum: number, sale: any) => sum + (sale.items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.qty || item.quantity || 0), 0), 0);
  const paymentTotal = (method: string) => localSales.filter((sale: any) => sale.paymentMethod === method).reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
  const invoices = localSales.map((sale: any) => ({
    id: sale.saleId,
    invoiceNumber: sale.saleId,
    fecha: sale.date,
    customer: sale.customerName ? { name: sale.customerName } : null,
    paymentMethod: sale.paymentMethod,
    subtotal: sale.subtotal,
    itbis: sale.tax,
    discount: sale.discount,
    total: sale.total,
    status: sale.synced === false ? 'pendiente' : 'emitida',
    items: sale.items || [],
  }));
  const movements = [
    ...localSales.map((sale: any) => ({ id: `sale-${sale.saleId}`, type: 'venta', description: `Venta ${sale.saleId}`, fecha: sale.date, paymentMethod: sale.paymentMethod, amount: sale.total, items: sale.items || [] })),
    ...localExpenses.map((expense: any) => ({ id: expense.id, type: 'gasto', description: expense.description, fecha: expense.date, paymentMethod: expense.paymentMethod, amount: -Math.abs(Number(expense.amount || 0)) })),
  ].sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return {
    dashboard: {
      salesToday: salesTotal,
      expensesToday: expensesTotal,
      netResult: salesTotal - expensesTotal,
      cashStatus: currentCash?.isOpen ? 'open' : 'closed',
      invoicesIssued: invoices.length,
      expectedCash: currentCash?.summary?.expectedCash || 0,
      transfers: paymentTotal('transfer'),
      card: paymentTotal('card'),
      productsSold,
      averageTicket: invoices.length ? salesTotal / invoices.length : 0,
    },
    invoices,
    journal: {
      totalDebit: expensesTotal,
      totalCredit: salesTotal,
      difference: salesTotal - expensesTotal,
      status: 'local',
      entries: movements.map((movement: any) => ({ id: movement.id, date: movement.fecha, category: movement.type, reference: movement.id, description: movement.description, debit: movement.type === 'gasto' ? Math.abs(movement.amount) : 0, credit: movement.type === 'venta' ? movement.amount : 0 })),
    },
    movements,
    movementTotals: [
      { _id: 'venta', total: salesTotal },
      { _id: 'gasto', total: expensesTotal },
    ],
    currentCash: currentCash?.isOpen ? currentCash : null,
    report: { summary: { salesTotal, expensesTotal, netResult: salesTotal - expensesTotal, productsSold }, payments: ['cash', 'card', 'transfer'].map((method) => ({ method, total: paymentTotal(method) })) },
  };
};

export const ReportsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AccountingTab>('dashboard');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [dashboard, setDashboard] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [journal, setJournal] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementTotals, setMovementTotals] = useState<any[]>([]);
  const [currentCash, setCurrentCash] = useState<any>(null);
  const [closings, setClosings] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', category: 'otros', amount: '', paymentMethod: 'cash', provider: '', receiptNumber: '' });
  const [cashForm, setCashForm] = useState({ openingAmount: '0', countedCash: '0', observations: '' });

  const queryParams = useMemo(() => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    ...(filters.text ? { text: filters.text, invoiceNumber: filters.text } : {}),
    ...(filters.customer ? { customer: filters.customer } : {}),
    ...(filters.cashier ? { cashier: filters.cashier } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }), [filters]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const local = await buildLocalAccounting(filters);
      setDashboard(local.dashboard);
      setInvoices(local.invoices);
      setJournal(local.journal);
      setMovements(filters.movementType ? local.movements.filter((movement: any) => movement.type === filters.movementType) : local.movements);
      setMovementTotals(local.movementTotals);
      setCurrentCash(local.currentCash);
      setReport(local.report);
      if (local.currentCash?.summary) {
        setCashForm((prev) => ({ ...prev, countedCash: String(Number(local.currentCash.summary.expectedCash || 0)) }));
      }

      const [dashboardRes, invoicesRes, journalRes, movementsRes, cashRes, closingsRes, reportRes] = await Promise.all([
        api.getAccountingDashboard({ date: filters.endDate || todayKey() }),
        api.getInvoices({ ...queryParams, limit: '100' }),
        api.getAccountingJournal({ date: filters.endDate || todayKey() }),
        api.getCashMovements({ startDate: filters.startDate, endDate: filters.endDate, ...(filters.movementType ? { type: filters.movementType } : {}), limit: '100' }),
        api.getCurrentCash(),
        api.getCashClosings({ startDate: filters.startDate, endDate: filters.endDate }),
        api.getReport('range', { startDate: filters.startDate, endDate: filters.endDate }),
      ]);
      setDashboard({ ...local.dashboard, ...(dashboardRes?.data || {}) });
      setInvoices([...(invoicesRes?.data || []), ...local.invoices.filter((invoice: any) => invoice.status === 'pendiente')]);
      setJournal(journalRes?.data || local.journal);
      setMovements([...(movementsRes?.data || []), ...local.movements]);
      setMovementTotals(movementsRes?.totalsByType || local.movementTotals);
      const openCash = cashRes?.data || local.currentCash;
      setCurrentCash(openCash);
      if (openCash?.summary) {
        setCashForm((prev) => ({ ...prev, countedCash: String(Number(openCash.summary.expectedCash || 0)) }));
      }
      setClosings(closingsRes?.data || []);
      setReport(reportRes?.data || local.report);
    } catch {
      const local = await buildLocalAccounting(filters);
      setDashboard(local.dashboard);
      setInvoices(local.invoices);
      setJournal(local.journal);
      setMovements(filters.movementType ? local.movements.filter((movement: any) => movement.type === filters.movementType) : local.movements);
      setMovementTotals(local.movementTotals);
      setCurrentCash(local.currentCash);
      setReport(local.report);
      if (local.currentCash?.summary) {
        setCashForm((prev) => ({ ...prev, countedCash: String(Number(local.currentCash.summary.expectedCash || 0)) }));
      }
    } finally {
      setRefreshing(false);
    }
  }, [filters, queryParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setFilter = (key: keyof Filters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  const buildRowsHtml = (title: string, rows: any[]) => `
    <html><head><meta charset="utf-8" /><style>
      body{font-family:Arial;color:#1f2933;padding:24px} header{border-bottom:2px solid #7c4a2d;margin-bottom:16px;padding-bottom:10px}
      h1{color:#5b341f;margin:0}.meta{color:#64748b;font-size:12px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff7ed}
      table{width:100%;border-collapse:collapse;font-size:12px} th{background:#5b341f;color:white;text-align:left;padding:8px} td{border-bottom:1px solid #e2e8f0;padding:8px}
      footer{margin-top:50px;display:flex;gap:48px}.sig{flex:1;border-top:1px solid #64748b;text-align:center;padding-top:8px}
    </style></head><body>
      <header><h1>☕ Cafeteando · ${title}</h1><div class="meta">Generado: ${new Date().toLocaleString()} · Filtros: ${filters.startDate} a ${filters.endDate}</div></header>
      <div class="summary"><div class="card">Ventas: ${money(report?.summary?.salesTotal)}</div><div class="card">Gastos: ${money(report?.summary?.expensesTotal)}</div><div class="card">Resultado: ${money(report?.summary?.netResult)}</div></div>
      <table><thead><tr><th>Fecha</th><th>Referencia</th><th>Detalle</th><th>Estado</th><th>Total</th></tr></thead><tbody>
        ${rows.map((row) => `<tr><td>${formatDate(row.fecha || row.date || row.createdAt)}</td><td>${row.invoiceNumber || row.reference || row.type || 'N/D'}</td><td>${row.customer?.name || row.description || row.category || 'N/D'}</td><td>${row.status || 'activo'}</td><td>${money(row.total || row.amount)}</td></tr>`).join('') || '<tr><td colspan="5">Sin datos.</td></tr>'}
      </tbody></table><footer><div class="sig">Preparado por</div><div class="sig">Revisado por</div></footer>
    </body></html>`;

  const printRows = async (title: string, rows: any[]) => {
    try {
      const html = buildRowsHtml(title, rows);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
      } else {
        Alert.alert('PDF generado', uri);
      }
    } catch (error) {
      Alert.alert('PDF', 'No se pudo generar el PDF.');
    }
  };

  const openCash = async () => {
    const openingAmount = Number(cashForm.openingAmount);
    if (!Number.isFinite(openingAmount) || openingAmount < 0) return Alert.alert('Caja', 'Monto inicial inválido.');
    try {
      await api.openAccountingCash(openingAmount);
    } catch {
      await api.openCashSession(openingAmount);
    }
    Alert.alert('Caja', 'Caja abierta correctamente.');
    loadData();
  };

  const closeCash = async () => {
    const countedCash = Number(cashForm.countedCash);
    if (!Number.isFinite(countedCash) || countedCash < 0) return Alert.alert('Caja', 'Efectivo contado inválido.');
    try {
      await api.closeAccountingCash({ countedCash, observations: cashForm.observations });
      Alert.alert('Caja', 'Cierre de caja guardado en MongoDB.');
    } catch {
      await api.closeCashSession(countedCash, cashForm.observations);
      Alert.alert('Caja', 'Cierre de caja guardado localmente.');
    }
    loadData();
  };

  const createExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.description.trim()) return Alert.alert('Gastos', 'La descripción es obligatoria.');
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert('Gastos', 'El monto debe ser mayor a 0.');
    const payload = { ...expenseForm, amount, fecha: `${filters.endDate}T12:00:00.000Z`, date: `${filters.endDate}T12:00:00.000Z` };
    await storeLocalExpense(payload);
    try {
      await api.createExpense(payload);
      Alert.alert('Gastos', 'Gasto registrado y sincronizado.');
    } catch {
      Alert.alert('Gastos', 'Gasto registrado localmente. Se sincronizará cuando haya conexión.');
    }
    setExpenseForm({ description: '', category: 'otros', amount: '', paymentMethod: 'cash', provider: '', receiptNumber: '' });
    loadData();
  };

  const voidInvoice = (invoice: any) => {
    if (Alert.prompt) {
      Alert.prompt('Anular factura', 'Motivo de anulación', async (reason) => {
        if (!reason?.trim()) return Alert.alert('Facturas', 'El motivo es obligatorio.');
        await api.voidInvoice(invoice.id, reason.trim());
        Alert.alert('Facturas', 'Factura anulada sin borrarla.');
        loadData();
      });
      return;
    }
    Alert.alert('Anular factura', 'En este dispositivo usa backend/admin para enviar el motivo de anulación.');
  };

  const kpis = [
    { label: 'Ventas del día', value: money(dashboard?.salesToday), icon: 'trending-up-outline', color: '#047857' },
    { label: 'Gastos del día', value: money(dashboard?.expensesToday), icon: 'trending-down-outline', color: '#b91c1c' },
    { label: 'Resultado neto', value: money(dashboard?.netResult), icon: 'analytics-outline', color: '#1d4ed8' },
    { label: 'Caja', value: dashboard?.cashStatus === 'open' ? 'Abierta' : 'Cerrada', icon: 'cash-outline', color: dashboard?.cashStatus === 'open' ? '#047857' : '#92400e' },
    { label: 'Facturas emitidas', value: String(dashboard?.invoicesIssued || 0), icon: 'receipt-outline', color: '#5b341f' },
    { label: 'Efectivo esperado', value: money(dashboard?.expectedCash), icon: 'wallet-outline', color: '#047857' },
    { label: 'Transferencias', value: money(dashboard?.transfers), icon: 'swap-horizontal-outline', color: '#4338ca' },
    { label: 'Tarjeta', value: money(dashboard?.card), icon: 'card-outline', color: '#0f766e' },
    { label: 'Productos vendidos', value: String(dashboard?.productsSold || 0), icon: 'cafe-outline', color: '#7c2d12' },
    { label: 'Ticket promedio', value: money(dashboard?.averageTicket), icon: 'stats-chart-outline', color: '#9333ea' },
  ];

  const FilterPanel = () => (
    <View style={styles.filterCard}>
      <Text style={styles.sectionTitle}>Filtros contables</Text>
      <View style={styles.filterGrid}>
        <TextInput style={styles.input} value={filters.startDate} onChangeText={(v) => setFilter('startDate', v)} placeholder="Inicio YYYY-MM-DD" />
        <TextInput style={styles.input} value={filters.endDate} onChangeText={(v) => setFilter('endDate', v)} placeholder="Fin YYYY-MM-DD" />
        <TextInput style={styles.input} value={filters.text} onChangeText={(v) => setFilter('text', v)} placeholder="Factura / referencia" />
        <TextInput style={styles.input} value={filters.customer} onChangeText={(v) => setFilter('customer', v)} placeholder="Cliente" />
        <TextInput style={styles.input} value={filters.cashier} onChangeText={(v) => setFilter('cashier', v)} placeholder="ID cajero" />
      </View>
      <View style={styles.chipRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={loadData}><Text style={styles.primaryButtonText}>Buscar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => setFilters(emptyFilters())}><Text style={styles.secondaryButtonText}>Hoy</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Módulo administrativo</Text>
          <Text style={styles.title}>Contabilidad</Text>
        </View>
        <TouchableOpacity style={styles.printButton} onPress={() => printRows('Reporte general', invoices)}>
          <Ionicons name="print-outline" size={18} color="#fff" />
          <Text style={styles.printButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#fff7ed' : '#7c4a2d'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 150 : 96) }]}
      >
        <FilterPanel />

        {activeTab === 'dashboard' && (
          <View style={styles.kpiGrid}>
            {kpis.map((kpi) => (
              <View key={kpi.label} style={styles.kpiCard}>
                <Ionicons name={kpi.icon as any} size={20} color={kpi.color} />
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'facturas' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Facturas funcionales</Text><TouchableOpacity onPress={() => printRows('Facturas', invoices)}><Text style={styles.link}>Imprimir</Text></TouchableOpacity></View>
            <View style={styles.chipRow}>{paymentMethods.map((p) => <TouchableOpacity key={p.value} style={[styles.chip, filters.paymentMethod === p.value && styles.chipActive]} onPress={() => setFilter('paymentMethod', p.value)}><Text style={styles.chipText}>{p.label}</Text></TouchableOpacity>)}</View>
            <View style={styles.chipRow}>{invoiceStatuses.map((s) => <TouchableOpacity key={s.value} style={[styles.chip, filters.status === s.value && styles.chipActive]} onPress={() => setFilter('status', s.value)}><Text style={styles.chipText}>{s.label}</Text></TouchableOpacity>)}</View>
            {invoices.map((invoice) => (
              <View key={invoice.id} style={styles.tableRow}>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>#{invoice.invoiceNumber}</Text>
                  <Text style={styles.rowMeta}>{formatDate(invoice.fecha)} · {invoice.customer?.name || 'Consumidor Final'} · {invoice.paymentMethod}</Text>
                  <Text style={styles.rowMeta}>Subtotal {money(invoice.subtotal)} · ITBIS {money(invoice.itbis)} · Descuento {money(invoice.discount)}</Text>
                </View>
                <View style={styles.actions}><Text style={[styles.status, invoice.status === 'anulada' && styles.statusDanger]}>{invoice.status}</Text><Text style={styles.amount}>{money(invoice.total)}</Text><TouchableOpacity onPress={() => printRows(`Factura ${invoice.invoiceNumber}`, [invoice])}><Text style={styles.link}>PDF</Text></TouchableOpacity><TouchableOpacity onPress={() => voidInvoice(invoice)}><Text style={styles.dangerLink}>Anular</Text></TouchableOpacity></View>
              </View>
            ))}
            {invoices.length === 0 && <Text style={styles.emptyText}>No hay facturas para los filtros seleccionados.</Text>}
          </View>
        )}

        {activeTab === 'diario' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Diario contable diario</Text><TouchableOpacity onPress={() => printRows('Diario contable', journal?.entries || [])}><Text style={styles.link}>Exportar PDF</Text></TouchableOpacity></View>
            <View style={styles.balanceRow}><Text style={styles.balanceText}>Debe: {money(journal?.totalDebit)}</Text><Text style={styles.balanceText}>Haber: {money(journal?.totalCredit)}</Text><Text style={journal?.status === 'cuadrado' ? styles.ok : styles.warning}>{journal?.status || 'sin datos'} · Dif. {money(journal?.difference)}</Text></View>
            {(journal?.entries || []).map((entry: any) => <View key={entry.id || entry._id} style={styles.tableRow}><View style={styles.tableMain}><Text style={styles.rowTitle}>{entry.description}</Text><Text style={styles.rowMeta}>{formatDate(entry.date)} · {entry.category} · {entry.reference || 'N/D'}</Text></View><View><Text style={styles.debit}>Debe {money(entry.debit)}</Text><Text style={styles.credit}>Haber {money(entry.credit)}</Text></View></View>)}
          </View>
        )}

        {activeTab === 'movimientos' && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Movimientos persistentes de caja</Text><TouchableOpacity onPress={() => printRows('Movimientos de caja', movements)}><Text style={styles.link}>Imprimir</Text></TouchableOpacity></View>
            <View style={styles.chipRow}>{movementTypes.map((type) => <TouchableOpacity key={type || 'all'} style={[styles.chip, filters.movementType === type && styles.chipActive]} onPress={() => setFilter('movementType', type)}><Text style={styles.chipText}>{type || 'todos'}</Text></TouchableOpacity>)}</View>
            <View style={styles.totalStrip}>{movementTotals.map((total) => <Text key={total._id} style={styles.totalText}>{total._id}: {money(total.total)}</Text>)}</View>
            {movements.map((movement) => <View key={movement.id} style={styles.tableRow}><View style={styles.tableMain}><Text style={styles.rowTitle}>{movement.type} · {movement.description}</Text><Text style={styles.rowMeta}>{formatDate(movement.fecha)} · {movement.paymentMethod} · {movement.user?.name || 'cajero'}</Text></View><Text style={styles.amount}>{money(movement.amount)}</Text></View>)}
          </View>
        )}

        {activeTab === 'gastos' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Gastos profesionales</Text>
            <TextInput style={styles.input} value={expenseForm.description} onChangeText={(v) => setExpenseForm((p) => ({ ...p, description: v }))} placeholder="Descripción" />
            <TextInput style={styles.input} value={expenseForm.amount} onChangeText={(v) => setExpenseForm((p) => ({ ...p, amount: v }))} placeholder="Monto" keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={expenseForm.provider} onChangeText={(v) => setExpenseForm((p) => ({ ...p, provider: v }))} placeholder="Proveedor opcional" />
            <View style={styles.chipRow}>{expenseCategories.map((category) => <TouchableOpacity key={category} style={[styles.chip, expenseForm.category === category && styles.chipActive]} onPress={() => setExpenseForm((p) => ({ ...p, category }))}><Text style={styles.chipText}>{category}</Text></TouchableOpacity>)}</View>
            <View style={styles.chipRow}>{paymentMethods.slice(1).map((p) => <TouchableOpacity key={p.value} style={[styles.chip, expenseForm.paymentMethod === p.value && styles.chipActive]} onPress={() => setExpenseForm((prev) => ({ ...prev, paymentMethod: p.value }))}><Text style={styles.chipText}>{p.label}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity style={styles.primaryButton} onPress={createExpense}><Text style={styles.primaryButtonText}>Registrar gasto</Text></TouchableOpacity>
          </View>
        )}

        {activeTab === 'caja' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Apertura y cierre de caja</Text>
            <View style={styles.cashBanner}><Text style={styles.cashBannerTitle}>{currentCash ? 'Caja abierta' : 'Caja cerrada'}</Text><Text style={styles.cashBannerText}>Efectivo esperado: {money(currentCash?.summary?.expectedCash || dashboard?.expectedCash)}</Text><Text style={styles.cashBannerHelp}>Incluye apertura + ventas en efectivo registradas en servidor, menos gastos/salidas. Tarjeta y transferencia se muestran aparte en KPIs.</Text></View>
            {!currentCash ? <><TextInput style={styles.input} value={cashForm.openingAmount} onChangeText={(v) => setCashForm((p) => ({ ...p, openingAmount: v }))} placeholder="Monto inicial" keyboardType="decimal-pad" /><TouchableOpacity style={styles.primaryButton} onPress={openCash}><Text style={styles.primaryButtonText}>Abrir caja</Text></TouchableOpacity></> : <><TextInput style={styles.input} value={cashForm.countedCash} onChangeText={(v) => setCashForm((p) => ({ ...p, countedCash: v }))} placeholder="Efectivo contado" keyboardType="decimal-pad" /><TextInput style={styles.input} value={cashForm.observations} onChangeText={(v) => setCashForm((p) => ({ ...p, observations: v }))} placeholder="Observaciones" /><TouchableOpacity style={styles.dangerButton} onPress={closeCash}><Text style={styles.primaryButtonText}>Cerrar caja y generar cierre</Text></TouchableOpacity></>}
            {closings.map((closing) => <View key={closing.id} style={styles.tableRow}><View style={styles.tableMain}><Text style={styles.rowTitle}>Cierre {closing.fechaContable}</Text><Text style={styles.rowMeta}>Contado {money(closing.countedCash)} · Esperado {money(closing.expectedCash)} · Dif. {money(closing.difference)}</Text></View><TouchableOpacity onPress={() => printRows('Cierre de caja', [closing])}><Text style={styles.link}>PDF</Text></TouchableOpacity></View>)}
          </View>
        )}

        {activeTab === 'reportes' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Reportes profesionales</Text>
            <View style={styles.reportGrid}>{[
              ['Reporte diario', report?.summary?.salesTotal], ['Reporte mensual', report?.summary?.netResult], ['Facturas', invoices.length], ['Métodos de pago', report?.payments?.length], ['Gastos', report?.summary?.expensesTotal], ['Productos vendidos', report?.summary?.productsSold],
            ].map(([label, value]) => <View key={String(label)} style={styles.reportCard}><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue}>{typeof value === 'number' ? money(value) : String(value || 0)}</Text></View>)}</View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => printRows('Reporte general', invoices)}><Text style={styles.primaryButtonText}>Descargar PDF / Imprimir reporte general</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0f0a' },
  header: { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: '#1a0f0a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#d4a574', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#f5f1e8', fontSize: 30, fontWeight: '900' },
  printButton: { flexDirection: 'row', gap: 6, backgroundColor: '#d4a574', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  printButtonText: { color: '#1a0f0a', fontWeight: '800' },
  tabs: { backgroundColor: '#1a0f0a', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#4a3428' },
  tab: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, marginHorizontal: 5, borderRadius: 12, borderWidth: 1, borderColor: '#4a3428', backgroundColor: '#2c1810' },
  activeTab: { backgroundColor: '#d4a574', borderColor: '#d4a574' },
  tabText: { color: '#d4a574', fontWeight: '800' },
  activeTabText: { color: '#1a0f0a' },
  content: { padding: 14, backgroundColor: '#1a0f0a' },
  filterCard: { backgroundColor: '#2c1810', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#4a3428' },
  filterGrid: { gap: 10 },
  input: { backgroundColor: '#30180f', borderWidth: 1, borderColor: '#4a3428', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#f5f1e8', marginBottom: 8 },
  sectionCard: { backgroundColor: '#2c1810', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#4a3428' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#f5f1e8', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '48%', backgroundColor: '#2c1810', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#4a3428', minHeight: 114 },
  kpiLabel: { color: '#b98b5f', fontSize: 12, fontWeight: '700', marginTop: 8 },
  kpiValue: { color: '#f5f1e8', fontSize: 20, fontWeight: '900', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#4a3428', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#30180f' },
  chipActive: { backgroundColor: '#4a3428', borderColor: '#d4a574' },
  chipText: { color: '#d4a574', fontWeight: '700', fontSize: 12 },
  primaryButton: { backgroundColor: '#d4a574', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 6 },
  dangerButton: { backgroundColor: '#c0392b', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#1a0f0a', fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#d4a574', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 6, backgroundColor: '#2c1810' },
  secondaryButtonText: { color: '#d4a574', fontWeight: '900' },
  tableRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#4a3428' },
  tableMain: { flex: 1 },
  rowTitle: { color: '#f5f1e8', fontWeight: '900', fontSize: 14 },
  rowMeta: { color: '#b98b5f', fontSize: 12, marginTop: 3 },
  actions: { alignItems: 'flex-end', gap: 3 },
  amount: { color: '#27ae60', fontWeight: '900' },
  status: { color: '#27ae60', fontWeight: '800', textTransform: 'uppercase', fontSize: 11 },
  statusDanger: { color: '#e74c3c' },
  link: { color: '#d4a574', fontWeight: '900' },
  dangerLink: { color: '#e74c3c', fontWeight: '900' },
  emptyText: { color: '#b98b5f', textAlign: 'center', padding: 22 },
  balanceRow: { backgroundColor: '#30180f', borderRadius: 12, padding: 12, gap: 6, marginBottom: 8, borderWidth: 1, borderColor: '#4a3428' },
  balanceText: { color: '#f5f1e8', fontWeight: '700' },
  ok: { color: '#27ae60', fontWeight: '900' },
  warning: { color: '#d4a574', fontWeight: '900' },
  debit: { color: '#e74c3c', fontWeight: '800', textAlign: 'right' },
  credit: { color: '#27ae60', fontWeight: '800', textAlign: 'right' },
  totalStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  totalText: { backgroundColor: '#30180f', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, color: '#d4a574', fontWeight: '800', borderWidth: 1, borderColor: '#4a3428' },
  cashBanner: { backgroundColor: '#30180f', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#4a3428' },
  cashBannerTitle: { color: '#f5f1e8', fontSize: 18, fontWeight: '900' },
  cashBannerText: { color: '#d4a574', marginTop: 4, fontWeight: '700' },
  cashBannerHelp: { color: '#b98b5f', marginTop: 6, fontSize: 12, lineHeight: 16 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportCard: { width: '48%', backgroundColor: '#30180f', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#4a3428' },
});

export default ReportsScreen;
