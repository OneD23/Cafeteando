const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, trim: true },
  module: { type: String, required: true, trim: true },
  outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
  requestId: { type: String, required: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditEventSchema.index({ module: 1, action: 1, createdAt: -1 });
auditEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
