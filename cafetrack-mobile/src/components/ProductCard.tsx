import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  icon: string;
  image?: string;
}

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const scale = new Animated.Value(1);
  const lowStock = product.stock <= product.minStock;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.container, lowStock && styles.lowStock]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Text style={styles.icon}>{product.icon || '☕'}</Text>
          {lowStock && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Bajo</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.price}>${product.price.toFixed(2)}</Text>
          
          <View style={styles.footer}>
            <Text style={[styles.stock, lowStock && styles.stockLow]}>
              {product.stock} disp.
            </Text>
            <View style={styles.addButton}>
              <Ionicons name="add" size={20} color="#1a0f0a" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c1810',
    borderRadius: 20,
    margin: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a3428',
    maxWidth: '48%',
  },
  lowStock: {
    borderColor: '#c0392b',
  },
  imageContainer: {
    height: 100,
    backgroundColor: '#3d2418',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 40,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#c0392b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
  },
  name: {
    color: '#f5f1e8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  price: {
    color: '#d4a574',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stock: {
    color: '#8b6f4e',
    fontSize: 11,
  },
  stockLow: {
    color: '#c0392b',
  },
  addButton: {
    width: 28,
    height: 28,
    backgroundColor: '#d4a574',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});