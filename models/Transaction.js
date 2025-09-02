const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  type: {
    type: String,
    enum: ['sale', 'restock', 'adjustment', 'expiry', 'damage','purchase'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  reason: String,
  userId: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);