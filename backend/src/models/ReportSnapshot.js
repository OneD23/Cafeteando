const mongoose = require('mongoose');

const reportSnapshotSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  type: { type: String, required: true, index: true },
  fechaContable: { type: String, index: true },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

reportSnapshotSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('ReportSnapshot', reportSnapshotSchema);
