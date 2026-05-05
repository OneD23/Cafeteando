import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, icon }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color="#d4a574" />
      </View>
      <View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
        {trend && <Text style={styles.trend}>{trend}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    color: '#8b6f4e',
    fontSize: 11,
  },
  trend: {
    color: '#27ae60',
    fontSize: 11,
    fontWeight: '600',
  },
});