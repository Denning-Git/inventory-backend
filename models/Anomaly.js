const mongoose = require('mongoose');
const anomalySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  type: {
    type: String,
    enum: ['low_stock', 'unusual_pattern', 'expiry_warning', 'high_variance', 'stock_discrepancy','potential_theft','unauthorized_access_pattern','security'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  aiConfidence: {
    type: Number,
    min: 0,
    max: 1
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Anomaly', anomalySchema);
