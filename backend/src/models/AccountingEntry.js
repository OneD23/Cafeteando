const mongoose = require('mongoose');

const accountingEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD
  direction: { type: String, enum: ['in', 'out'], required: true },
  category: { type: String, enum: ['sale', 'cogs', 'expense', 'adjustment', 'other'], required: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  reference: { type: String, trim: true, index: true },
  sourceType: { type: String, enum: ['sale', 'manual', 'cash'], default: 'manual' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

accountingEntrySchema.index({ dayKey: 1, createdAt: -1 });
accountingEntrySchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('AccountingEntry', accountingEntrySchema);
