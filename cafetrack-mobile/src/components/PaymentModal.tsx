import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  total: number;
  loading?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onConfirm,
  total,
  loading,
}) => {
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [discount, setDiscount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cashReceived, setCashReceived] = useState('');

  const parsedDiscount = discount ? Math.max(parseFloat(discount) || 0, 0) : 0;
  const payableTotal = Math.max(total - parsedDiscount, 0);
  const parsedCashReceived = cashReceived ? Math.max(parseFloat(cashReceived) || 0, 0) : 0;
  const change = method === 'cash' ? Math.max(parsedCashReceived - payableTotal, 0) : 0;
  const isCashInsufficient = method === 'cash' && parsedCashReceived < payableTotal;

  const handleConfirm = () => {
    onConfirm({
      method,
      discount: parsedDiscount,
      cashReceived: method === 'cash' ? parsedCashReceived : undefined,
      change: method === 'cash' ? change : 0,
      customer: customerName ? { name: customerName } : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>💳 Pago</Text>
          
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total a pagar:</Text>
            <Text style={styles.totalValue}>${payableTotal.toFixed(2)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Método de pago</Text>
          <View style={styles.methods}>
            {(['cash', 'card', 'transfer'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.method, method === m && styles.methodActive]}
                onPress={() => setMethod(m)}
              >
                <Ionicons 
                  name={m === 'cash' ? 'cash-outline' : m === 'card' ? 'card-outline' : 'phone-portrait-outline'} 
                  size={28} 
                  color={method === m ? '#1a0f0a' : '#d4a574'} 
                />
                <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                  {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transferencia'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Descuento (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#8b6f4e"
            keyboardType="decimal-pad"
            value={discount}
            onChangeText={setDiscount}
          />


          {method === 'cash' && (
            <>
              <Text style={styles.sectionTitle}>Monto recibido</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#8b6f4e"
                keyboardType="decimal-pad"
                value={cashReceived}
                onChangeText={setCashReceived}
              />

              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>Devuelta:</Text>
                <Text style={styles.changeValue}>${change.toFixed(2)}</Text>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Cliente (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del cliente"
            placeholderTextColor="#8b6f4e"
            value={customerName}
            onChangeText={setCustomerName}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmButton, (loading || isCashInsufficient) && styles.disabled]} 
              onPress={handleConfirm}
              disabled={loading || isCashInsufficient}
            >
              <Text style={styles.confirmText}>
                {loading ? 'Procesando...' : isCashInsufficient ? 'Efectivo insuficiente' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1a0f0a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '80%',
  },
  title: {
    fontSize: 24,
    color: '#f5f1e8',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  totalBox: {
    backgroundColor: '#2c1810',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#d4a574',
  },
  totalLabel: {
    color: '#8b6f4e',
    fontSize: 14,
  },
  totalValue: {
    color: '#d4a574',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 5,
  },
  sectionTitle: {
    color: '#f5f1e8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  methods: {
    flexDirection: 'row',
    gap: 10,
  },
  method: {
    flex: 1,
    backgroundColor: '#2c1810',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4a3428',
  },
  methodActive: {
    backgroundColor: '#d4a574',
    borderColor: '#d4a574',
  },
  methodText: {
    color: '#8b6f4e',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  methodTextActive: {
    color: '#1a0f0a',
  },
  input: {
    backgroundColor: '#2c1810',
    borderRadius: 12,
    padding: 15,
    color: '#f5f1e8',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4a3428',
  },

  changeBox: {
    backgroundColor: '#2c1810',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4a3428',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    color: '#f5f1e8',
    fontSize: 14,
    fontWeight: '600',
  },
  changeValue: {
    color: '#27ae60',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 25,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2c1810',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4a3428',
  },
  cancelText: {
    color: '#f5f1e8',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});