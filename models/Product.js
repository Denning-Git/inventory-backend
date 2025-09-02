const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  expiryDate: {
    type: Date,
    default: null
  },
  minimumStock: {
    type: Number,
    default: 10
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);