import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface CategoryFilterProps {
  selected: string;
  onSelect: (id: string) => void;
}

const categories: Category[] = [
  { id: 'all', name: 'Todos', icon: 'grid-outline' },
  { id: 'coffee', name: 'Cafés', icon: 'cafe-outline' },
  { id: 'pastry', name: 'Pasteles', icon: 'pizza-outline' },
  { id: 'drink', name: 'Bebidas', icon: 'beer-outline' },
  { id: 'food', name: 'Comida', icon: 'restaurant-outline' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ selected, onSelect }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[
            styles.chip,
            selected === cat.id && styles.chipActive
          ]}
          onPress={() => onSelect(cat.id)}
        >
          <Ionicons 
            name={cat.icon} 
            size={18} 
            color={selected === cat.id ? '#1a0f0a' : '#d4a574'} 
          />
          <Text style={[
            styles.text,
            selected === cat.id && styles.textActive
          ]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 70,
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: 15,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c1810',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#4a3428',
  },
  chipActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  text: {
    color: '#8b6f4e',
    fontSize: 13,
    fontWeight: '600',
  },
  textActive: {
    color: '#1a0f0a',
  },
});