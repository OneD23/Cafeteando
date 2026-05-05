import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon: string;
}

interface CartSheetProps {
  items: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export const CartSheet: React.FC<CartSheetProps> = ({
  items,
  totals,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🛒 Carrito ({items.length})</Text>
        <Text style={styles.subtitle}>Desliza para ver más</Text>
      </View>

      <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.icon} {item.name}</Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)} c/u</Text>
            </View>
            
            <View style={styles.controls}>
              <TouchableOpacity 
                style={styles.qtyButton}
                onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Text style={styles.qtyText}>−</Text>
              </TouchableOpacity>
              
              <Text style={styles.quantity}>{item.quantity}</Text>
              
              <TouchableOpacity 
                style={styles.qtyButton}
                onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => onRemove(item.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>${totals.total.toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity style={styles.checkoutButton} onPress={onCheckout}>
          <Text style={styles.checkoutText}>PAGAR AHORA</Text>
          <Ionicons name="arrow-forward" size={20} color="#1a0f0a" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a0f0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 3,
    borderTopColor: '#d4a574',
    padding: 20,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8b6f4e',
    fontSize: 12,
  },
  itemsList: {
    maxHeight: 200,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c1810',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#f5f1e8',
    fontSize: 14,
    fontWeight: '600',
  },
  itemPrice: {
    color: '#8b6f4e',
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    backgroundColor: '#4a3428',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    color: '#f5f1e8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantity: {
    color: '#f5f1e8',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    backgroundColor: '#c0392b',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#4a3428',
    paddingTop: 15,
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  totalLabel: {
    color: '#f5f1e8',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#27ae60',
    fontSize: 28,
    fontWeight: 'bold',
  },
  checkoutButton: {
    backgroundColor: '#d4a574',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  checkoutText: {
    color: '#1a0f0a',
    fontSize: 18,
    fontWeight: 'bold',
  },
});