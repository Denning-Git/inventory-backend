app.get('/api/transactions', async (req, res) => {
  try {
    const { productId, type, startDate, endDate, limit = 50 } = req.query;
    
    let filter = {};
    if (productId) filter.productId = productId;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('productId', 'name category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Anomalies Routes
app.get('/api/anomalies', async (req, res) => {
  try {
    const { resolved, severity, type } = req.query;
    
    let filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const anomalies = await Anomaly.find(filter)
      .populate('productId', 'name category')
      .sort({ createdAt: -1 });

    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/anomalies/:id/resolve', async (req, res) => {
  try {
    const anomaly = await Anomaly.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    ).populate('productId', 'name category');

    if (!anomaly) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    res.json(anomaly);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/api/ai/detect-anomalies', async (req, res) => {
  try {
    const anomalies = await AIAnomalyDetector.detectAnomalies();
    const alerts = await AIAnomalyDetector.generateAlerts();
    
    res.json({
      message: 'Anomaly detection completed',
      anomaliesDetected: anomalies.length,
      alertsGenerated: alerts.length,
      anomalies: anomalies.slice(0, 10), // Return first 10 for preview
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});