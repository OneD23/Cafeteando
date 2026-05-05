import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type JournalDirection = 'in' | 'out';

export interface JournalEntry {
  id: string;
  date: string;
  direction: JournalDirection;
  category: 'sale' | 'cogs' | 'inventory' | 'adjustment' | 'other';
  description: string;
  amount: number;
  reference?: string;
}

interface AccountingState {
  entries: JournalEntry[];
}

const initialState: AccountingState = {
  entries: [],
};

const createEntry = (payload: Omit<JournalEntry, 'id' | 'date'>): JournalEntry => ({
  ...payload,
  id: `jnl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  date: new Date().toISOString(),
});

const accountingSlice = createSlice({
  name: 'accounting',
  initialState,
  reducers: {
    addJournalEntry: (state, action: PayloadAction<Omit<JournalEntry, 'id' | 'date'>>) => {
      state.entries.unshift(createEntry(action.payload));
    },
    recordSale: (state, action: PayloadAction<{
      saleId: string;
      revenue: number;
      cogs: number;
    }>) => {
      const { saleId, revenue, cogs } = action.payload;

      state.entries.unshift(createEntry({
        direction: 'in',
        category: 'sale',
        description: `Venta registrada (${saleId})`,
        amount: revenue,
        reference: saleId,
      }));

      state.entries.unshift(createEntry({
        direction: 'out',
        category: 'cogs',
        description: `Costo de venta (${saleId})`,
        amount: cogs,
        reference: saleId,
      }));
    },
    clearJournal: (state) => {
      state.entries = [];
    },
  },
});

export const { addJournalEntry, recordSale, clearJournal } = accountingSlice.actions;
export default accountingSlice.reducer;
