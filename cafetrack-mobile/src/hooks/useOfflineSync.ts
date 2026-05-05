import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api/client';
import { clearQueue, getQueue } from '../store/offlineSlice';

export const useOfflineSync = () => {
  const dispatch = useDispatch();
  const queue = useSelector(getQueue) as Array<{
    id: string;
    type: 'sale' | 'update' | 'delete';
    data: any;
  }>;

  const syncOfflineQueue = useCallback(async () => {
    if (queue.length === 0) {
      return { synced: 0 };
    }

    let synced = 0;
    const failed: string[] = [];

    for (const operation of queue) {
      try {
        if (operation.type === 'sale') {
          await api.createSale(operation.data);
          synced += 1;
          continue;
        }

        if (operation.type === 'update' && operation.data?.ingredientId) {
          const { ingredientId, newStock, reason } = operation.data;
          await api.adjustStock(ingredientId, newStock, reason || 'Sync offline');
          synced += 1;
          continue;
        }

        if (operation.type === 'delete' && operation.data?.ingredientId) {
          await api.deleteIngredient(operation.data.ingredientId);
          synced += 1;
          continue;
        }

        failed.push(operation.id);
      } catch (error) {
        failed.push(operation.id);
      }
    }

    if (failed.length === 0) {
      dispatch(clearQueue());
    }

    return {
      synced,
      failed,
      pending: queue.length - synced,
    };
  }, [dispatch, queue]);

  const clearOfflineQueue = useCallback(() => {
    dispatch(clearQueue());
  }, [dispatch]);

  return {
    syncOfflineQueue,
    clearOfflineQueue,
    pendingCount: queue.length,
  };
};
