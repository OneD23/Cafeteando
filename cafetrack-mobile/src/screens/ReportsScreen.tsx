import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export const ReportsScreen: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const { ingredients, movements } = useSelector((state: any) => state.inventory);
  const { products } = useSelector((state: any) => state.recipes);
  const { entries } = useSelector((state: any) => state.accounting);

  // Calcular métricas
  const totalInventoryValue = ingredients.reduce((sum: number, ing: any) => 
    sum + (ing.stock * ing.costPerUnit), 0
  );

  const lowStockCount = ingredients.filter((ing: any) => 
    ing.stock <= ing.minStock
  ).length;

  const totalMovements = movements.length;
  const totalEntries = entries
    .filter((e: any) => e.direction === 'in')
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalExits = entries
    .filter((e: any) => e.direction === 'out')
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  const netResult = totalEntries - totalExits;

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
      label: 'Resultado', 
      value: `$${netResult.toFixed(2)}`,
      icon: 'trending-up-outline',
      color: netResult >= 0 ? '#27ae60' : '#c0392b'
    },
  ];

  const recentMovements = movements.slice(-10).reverse();
  const recentJournal = entries.slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📊 Reportes y Análisis</Text>

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

      {/* Stats Grid */}
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

      {/* Recent Movements */}
      <Text style={styles.sectionTitle}>📋 Movimientos Recientes</Text>
      <ScrollView style={styles.movementsList}>
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
          })
        )}
      </ScrollView>

      <Text style={styles.sectionTitle}>📒 Diario Contable</Text>
      <ScrollView style={styles.movementsList}>
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
          ))
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
  movementsList: {
    flex: 1,
    paddingHorizontal: 15,
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
