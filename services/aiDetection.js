class AIAnomalyDetector {
  static async detectAnomalies() {
    try {
      console.log('🤖 Running AI anomaly detection...');
      
      // Get all products with recent transactions
      const products = await Product.find({});
      const anomalies = [];

      for (const product of products) {
        // Check for low stock
        if (product.quantity <= product.minimumStock) {
          const existingAnomaly = await Anomaly.findOne({
            productId: product._id,
            type: 'low_stock',
            resolved: false
          });

          if (!existingAnomaly) {
            anomalies.push({
              productId: product._id,
              type: 'low_stock',
              severity: product.quantity === 0 ? 'critical' : 'high',
              description: `Stock critically low: ${product.quantity} units remaining`,
              aiConfidence: 0.95,
              metadata: {
                currentStock: product.quantity,
                minimumStock: product.minimumStock
              }
            });
          }
        }

        // Check for expiry warnings
        if (product.expiryDate) {
          const daysUntilExpiry = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            const existingAnomaly = await Anomaly.findOne({
              productId: product._id,
              type: 'expiry_warning',
              resolved: false
            });

            if (!existingAnomaly) {
              anomalies.push({
                productId: product._id,
                type: 'expiry_warning',
                severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
                description: `Product expires in ${daysUntilExpiry} days`,
                aiConfidence: 0.90,
                metadata: {
                  daysUntilExpiry,
                  expiryDate: product.expiryDate
                }
              });
            }
          }
        }

        // Analyze transaction patterns for unusual activity
        const recentTransactions = await Transaction.find({
          productId: product._id,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (recentTransactions.length >= 3) {
          const pattern = this.analyzeTransactionPattern(recentTransactions);
          
          if (pattern.isUnusual) {
            const existingAnomaly = await Anomaly.findOne({
              productId: product._id,
              type: 'unusual_pattern',
              resolved: false,
              createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            if (!existingAnomaly) {
              anomalies.push({
                productId: product._id,
                type: 'unusual_pattern',
                severity: pattern.severity,
                description: pattern.description,
                aiConfidence: pattern.confidence,
                metadata: pattern.metadata
              });
            }
          }
        }
      }

      // Save detected anomalies
      if (anomalies.length > 0) {
        await Anomaly.insertMany(anomalies);
        console.log(`🚨 Detected ${anomalies.length} new anomalies`);
      }

      return anomalies;
    } catch (error) {
      console.error('❌ Error in anomaly detection:', error);
      return [];
    }
  }

  static analyzeTransactionPattern(transactions) {
    // Simple pattern analysis - can be enhanced with more sophisticated ML
    const sales = transactions.filter(t => t.type === 'sale');
    const avgSaleQuantity = sales.reduce((sum, t) => sum + Math.abs(t.quantity), 0) / sales.length;
    
    // Check for sudden large sales
    const largeSales = sales.filter(t => Math.abs(t.quantity) > avgSaleQuantity * 3);
    
    if (largeSales.length > 0) {
      return {
        isUnusual: true,
        severity: 'medium',
        description: `Unusual sales pattern detected: ${largeSales.length} unusually large transactions`,
        confidence: 0.75,
        metadata: {
          largeSalesCount: largeSales.length,
          avgSaleQuantity,
          maxSaleQuantity: Math.max(...largeSales.map(t => Math.abs(t.quantity)))
        }
      };
    }

    // Check for high frequency transactions
    if (transactions.length > 10) {
      return {
        isUnusual: true,
        severity: 'low',
        description: `High transaction frequency: ${transactions.length} transactions in 7 days`,
        confidence: 0.60,
        metadata: {
          transactionCount: transactions.length,
          period: '7 days'
        }
      };
    }

    return { isUnusual: false };
  }

  static async generateAlerts() {
    try {
      const unreadAnomalies = await Anomaly.find({ resolved: false })
        .populate('productId', 'name category')
        .sort({ createdAt: -1 });

      const alerts = [];
      
      for (const anomaly of unreadAnomalies) {
        const existingAlert = await Alert.findOne({
          type: 'anomaly',
          productId: anomaly.productId._id,
          createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
        });

        if (!existingAlert) {
          alerts.push({
            type: 'anomaly',
            title: `${anomaly.type.replace('_', ' ').toUpperCase()} Alert`,
            message: `${anomaly.productId.name}: ${anomaly.description}`,
            severity: anomaly.severity === 'critical' ? 'error' : 
                     anomaly.severity === 'high' ? 'warning' : 'info',
            productId: anomaly.productId._id
          });
        }
      }

      if (alerts.length > 0) {
        await Alert.insertMany(alerts);
      }

      return alerts;
    } catch (error) {
      console.error('❌ Error generating alerts:', error);
      return [];
    }
  }
}