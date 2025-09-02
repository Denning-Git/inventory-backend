const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['low_stock', 'expiry', 'anomaly', 'system','security'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);
