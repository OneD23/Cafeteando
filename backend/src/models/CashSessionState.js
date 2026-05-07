const mongoose = require('mongoose');

const cashSessionStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  isOpen: { type: Boolean, default: false },
  openedAt: { type: Date, default: null },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  openingAmount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('CashSessionState', cashSessionStateSchema);
