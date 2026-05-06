import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

const KEY = 'sync_queue_v1';

export const initLocalDb = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) await AsyncStorage.setItem(KEY, JSON.stringify([]));
};

export const queueUnsynced = async (entity: string, payload: any) => {
  const raw = await AsyncStorage.getItem(KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({ id: Date.now(), entity, payload, synced: 0, created_at: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
};

export const pendingQueue = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  const queue = raw ? JSON.parse(raw) : [];
  return queue.filter((q: any) => !q.synced);
};

export const syncPendingData = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  const queue = raw ? JSON.parse(raw) : [];
  for (const row of queue) {
    if (row.synced) continue;
    try {
      if (row.entity === 'sale') {
        const payload = { ...row.payload };
        if (!payload.customer && payload.customerName) payload.customer = { name: payload.customerName };
        await api.createSale(payload);
      }
      row.synced = 1;
    } catch {
      break;
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
};
