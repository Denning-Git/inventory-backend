app.get('/api/alerts', async (req, res) => {
  try {
    const { read, type, severity } = req.query;
    
    let filter = {};
    if (read !== undefined) filter.read = read === 'true';
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const alerts = await Alert.find(filter)
      .populate('productId', 'name category')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/alerts/:id/read', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$quantity', '$price'] } }
        }
      }
    ]);

    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$minimumStock'] }
    });

    const criticalAnomalies = await Anomaly.countDocuments({
      resolved: false,
      severity: { $in: ['high', 'critical'] }
    });

    const recentTransactions = await Transaction.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).countDocuments();

    const categoryStats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalProducts,
      totalValue: totalValue[0]?.total || 0,
      lowStockCount,
      criticalAnomalies,
      recentTransactions,
      categoryStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
