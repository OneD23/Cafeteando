const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  externalId: {
    type: String,
    trim: true,
    index: true,
    sparse: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  taxId: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  creditActive: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  syncId: String,
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

clientSchema.index({ name: 1 });
clientSchema.index({ phone: 1 });
clientSchema.index({ email: 1 });

module.exports = mongoose.model('Client', clientSchema);
