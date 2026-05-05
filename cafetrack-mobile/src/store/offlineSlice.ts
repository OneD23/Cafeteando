import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineOperation {
  id: string;
  type: 'sale' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

interface OfflineState {
  queue: OfflineOperation[];
  isSyncing: boolean;
  lastSync: number | null;
}

const initialState: OfflineState = {
  queue: [],
  isSyncing: false,
  lastSync: null,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    addToQueue: (state: any, action: PayloadAction<Omit<OfflineOperation, 'id' | 'timestamp' | 'retries'>>) => {
      state.queue.push({
        ...action.payload,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        retries: 0,
      });
    },
    removeFromQueue: (state: any, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((item: any) => item.id !== action.payload);
    },
    clearQueue: (state: any) => {
      state.queue = [];
    },
    setSyncing: (state: any, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    incrementRetry: (state: any, action: PayloadAction<string>) => {
      const item = state.queue.find((item: any) => item.id === action.payload);
      if (item) item.retries += 1;
    },
  },
});

export const { addToQueue, removeFromQueue, clearQueue, setSyncing, incrementRetry } = offlineSlice.actions;
export const getQueue = (state: any) => state.offline.queue;
export default offlineSlice.reducer;