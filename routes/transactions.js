const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// Create new transaction
router.post('/', async (req, res) => {
  try {
    const { type, amount, productId, userId } = req.body;

    const newTransaction = new Transaction({
      type,      // "purchase", "refund", or "theft"
      amount,    // numeric
      productId, // product reference
      userId     // user reference
    });

    await newTransaction.save();
    res.status(201).json({ success: true, transaction: newTransaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const txs = await Transaction.find().sort({ createdAt: -1 });
    res.json(txs);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;