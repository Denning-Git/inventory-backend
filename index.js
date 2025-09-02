require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


const Product = require('./models/Product');
const Transaction = require('./models/Transaction');
const Anomaly = require('./models/Anomaly');
const Alert = require('./models/Alert');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI,{maxPoolSize: 10});
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};


// AI Anomaly Detection System
class EnhancedAIAnomalyDetector {
  static async detectAnomalies() {
    try {
      console.log('🤖 Running enhanced AI anomaly detection with theft detection...');
      
      const products = await Product.find({});
      // console.log(products)
      const anomalies = [];

      for (const product of products) {
        // Existing detection methods...
        await this.detectLowStock(product, anomalies);
        await this.detectExpiryWarnings(product, anomalies);
        // await this.detectUnusualPatterns(product, anomalies);
        
        // New theft detection methods
        await this.detectPotentialTheft(product, anomalies);
        await this.detectShrinkagePatterns(product, anomalies);
        await this.detectUnauthorizedAccess(product, anomalies);
      }

      // Cross-product theft pattern analysis
      await this.detectSystemwideTheftPatterns(anomalies);

      if (anomalies.length > 0) {
        await Anomaly.insertMany(anomalies);
        console.log(`🚨 Detected ${anomalies.length} new anomalies (including potential theft)`);
      }

      return anomalies;
    } catch (error) {
      console.error('❌ Error in enhanced anomaly detection:', error);
      return [];
    }
  }


  static async detectLowStock(product, anomalies) {
    try {
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
    } catch (error) {
      console.error('Error in low stock detection:', error);
    }
  }

  static async detectExpiryWarnings(product, anomalies) {
    try {
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
    } catch (error) {
      console.error('Error in expiry detection:', error);
    }
  }

  // Detect unexplained stock discrepancies that could indicate theft
  static async detectPotentialTheft(product, anomalies) {
    try {
      // Get all transactions for the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const transactions = await Transaction.find({
        productId: product._id,
        createdAt: { $gte: thirtyDaysAgo }
      }).sort({ createdAt: 1 });

      if (transactions.length === 0) return;

      // Calculate expected vs actual stock levels
      let calculatedStock = transactions[0].previousQuantity;
      let unexplainedLosses = [];

      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        calculatedStock += transaction.quantity;

        // Check for discrepancies between calculated and recorded stock
        if (Math.abs(calculatedStock - transaction.newQuantity) > 0) {
          const discrepancy = transaction.newQuantity - calculatedStock;
          
          if (discrepancy < -2) { // More than 2 units missing
            unexplainedLosses.push({
              date: transaction.createdAt,
              expectedStock: calculatedStock,
              actualStock: transaction.newQuantity,
              discrepancy: Math.abs(discrepancy),
              transactionId: transaction._id
            });

           
          }
        }
        calculatedStock = transaction.newQuantity;
      }

      // Check current stock against last transaction
      const lastTransaction = transactions[transactions.length - 1];


      if (product.quantity < lastTransaction.newQuantity) {
        const currentDiscrepancy = lastTransaction.newQuantity - product.quantity;
        // console.log(currentDiscrepancy > 2)

        if (currentDiscrepancy > 2) {
          unexplainedLosses.push({
            date: new Date(),
            expectedStock: lastTransaction.newQuantity,
            actualStock: product.quantity,
            discrepancy: currentDiscrepancy,
            type: 'current_discrepancy'
          });

          //  console.log('current_discrepancy',unexplainedLosses)
        }
      }

      // Generate theft alert if significant unexplained losses
      if (unexplainedLosses.length > 0) {

        const totalLoss = unexplainedLosses.reduce((sum, loss) => sum + loss.discrepancy, 0);

        // console.log('totalLoss',totalLoss)

        const lossValue = totalLoss * (product.price || 0);

        const existingAnomaly = await Anomaly.findOne({
          productId: product._id,
          type: 'potential_theft',
          resolved: false,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        // console.log('existingAnomaly',JSON.stringify(existingAnomaly)) 

        if (existingAnomaly && totalLoss > 3) {
          anomalies.push({
            productId: product._id,
            type: 'potential_theft',
            severity: lossValue > 500 ? 'critical' : totalLoss > 10 ? 'high' : 'medium',
            description: `Potential theft detected: ${totalLoss} units (${lossValue.toFixed(2)} ${product.currency || 'USD'}) unaccounted for`,
            aiConfidence: this.calculateTheftConfidence(unexplainedLosses, totalLoss),
            metadata: {
              totalUnitsLost: totalLoss,
              estimatedValue: lossValue,
              discrepancyCount: unexplainedLosses.length,
              unexplainedLosses: unexplainedLosses.slice(0, 5), 
              analysisPeriod: '30 days'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in theft detection:', error);
    }
  }

  // Detect shrinkage patterns (gradual stock loss)
  static async detectShrinkagePatterns(product, anomalies) {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const transactions = await Transaction.find({
        productId: product._id,
        createdAt: { $gte: ninetyDaysAgo }
      }).sort({ createdAt: 1 });

      if (transactions.length < 10) return; // Need sufficient data

      // Calculate shrinkage rate (stock lost per day not accounted by sales)
      const sales = transactions.filter(t => t.type === 'sale');
      const restocks = transactions.filter(t => t.type === 'restock' || t.type === 'purchase');
      
      const totalSales = sales.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      const totalRestocks = restocks.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      
      const expectedCurrentStock = (transactions[0]?.previousQuantity || 0) + totalRestocks - totalSales;
      const actualCurrentStock = product.quantity;
      const shrinkage = expectedCurrentStock - actualCurrentStock;
      const shrinkageRate = shrinkage / 90; // Per day

      if (shrinkageRate > 0.5 && shrinkage > 5) { // More than 0.5 units lost per day
        const existingAnomaly = await Anomaly.findOne({
          productId: product._id,
          type: 'inventory_shrinkage',
          // resolved: false,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        if (!existingAnomaly) {
          anomalies.push({
            productId: product._id,
            type: 'inventory_shrinkage',
            severity: shrinkageRate > 2 ? 'high' : 'medium',
            description: `Inventory shrinkage detected: ${shrinkage.toFixed(1)} units lost over 90 days (${shrinkageRate.toFixed(2)} units/day)`,
            aiConfidence: 0.80,
            metadata: {
              totalShrinkage: shrinkage,
              dailyShrinkageRate: shrinkageRate,
              expectedStock: expectedCurrentStock,
              actualStock: actualCurrentStock,
              analysisPeriod: '90 days',
              totalSales,
              totalRestocks
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in shrinkage detection:', error);
    }
  }

  // Detect unusual access patterns that might indicate unauthorized access
  static async detectUnauthorizedAccess(product, anomalies) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const transactions = await Transaction.find({
        productId: product._id,
        createdAt: { $gte: sevenDaysAgo }
      });

      // Analyze transaction timing patterns
      const hourlyActivity = new Array(24).fill(0);
      const userActivity = {};
      const unusualPatterns = [];

      transactions.forEach(transaction => {
        const hour = new Date(transaction.createdAt).getHours();
        hourlyActivity[hour]++;
        
        const userId = transaction.userId || 'unknown';
        userActivity[userId] = (userActivity[userId] || 0) + 1;
      });

      // Check for transactions during unusual hours (e.g., 11 PM - 5 AM)
      const nightTransactions = hourlyActivity.slice(23, 24).concat(hourlyActivity.slice(0, 6));
      const totalNightActivity = nightTransactions.reduce((sum, count) => sum + count, 0);
      
      if (totalNightActivity > 2) {
        unusualPatterns.push({
          type: 'after_hours_access',
          count: totalNightActivity,
          description: `${totalNightActivity} transactions during non-business hours`
        });
      }

      // Check for users with excessive activity
      Object.entries(userActivity).forEach(([userId, count]) => {
        if (count > 10 && userId !== 'system') { // More than 10 transactions by one user
          unusualPatterns.push({
            type: 'excessive_user_activity',
            userId,
            count,
            description: `User ${userId} performed ${count} transactions in 7 days`
          });
        }
      });

      if (unusualPatterns.length > 0) {
        const existingAnomaly = await Anomaly.findOne({
          productId: product._id,
          type: 'unauthorized_access_pattern',
          // resolved: false,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (!existingAnomaly) {
          anomalies.push({
            productId: product._id,
            type: 'unauthorized_access_pattern',
            severity: unusualPatterns.some(p => p.type === 'after_hours_access') ? 'high' : 'medium',
            description: `Unusual access patterns detected: ${unusualPatterns.map(p => p.description).join(', ')}`,
            aiConfidence: 0.70,
            metadata: {
              patterns: unusualPatterns,
              totalTransactions: transactions.length,
              analysisWindow: '7 days'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in unauthorized access detection:', error);
    }
  }

  // Detect system-wide theft patterns across multiple products
  static async detectSystemwideTheftPatterns(anomalies) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Check for multiple high-value items with discrepancies on the same day
      const highValueProducts = await Product.find({ 
        price: { $gt: 100 } // Products worth more than 100 currency units
      });

      let suspiciousActivity = [];
      
      for (const product of highValueProducts) {
        const recentTransactions = await Transaction.find({
          productId: product._id,
          createdAt: { $gte: oneDayAgo }
        });

        // Look for products with recent activity but unexplained stock reduction
        if (recentTransactions.length > 0) {
          const lastTransaction = recentTransactions[recentTransactions.length - 1];
          if (product.quantity < lastTransaction.newQuantity) {
            const discrepancy = lastTransaction.newQuantity - product.quantity;
            if (discrepancy > 0) {
              suspiciousActivity.push({
                productId: product._id,
                productName: product.name,
                discrepancy,
                value: discrepancy * product.price,
                lastTransactionTime: lastTransaction.createdAt
              });
            }
          }
        }
      }

      // If multiple high-value items show discrepancies, flag as organized theft
      if (suspiciousActivity.length >= 3) {
        const totalValue = suspiciousActivity.reduce((sum, item) => sum + item.value, 0);
        
        anomalies.push({
          productId: null, // System-wide anomaly
          type: 'organized_theft_pattern',
          severity: 'critical',
          description: `Potential organized theft: ${suspiciousActivity.length} high-value items with discrepancies (total value: ${totalValue.toFixed(2)})`,
          aiConfidence: 0.85,
          metadata: {
            affectedProducts: suspiciousActivity.length,
            totalValue,
            suspiciousItems: suspiciousActivity.slice(0, 10),
            detectionTime: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error in system-wide theft detection:', error);
    }
  }

  // Calculate confidence level for theft detection
  static calculateTheftConfidence(unexplainedLosses, totalLoss) {
    let confidence = 0.5; // Base confidence

    // Higher confidence for multiple discrepancies
    if (unexplainedLosses.length > 2) confidence += 0.1;
    if (unexplainedLosses.length > 5) confidence += 0.1;

    // Higher confidence for larger losses
    if (totalLoss > 10) confidence += 0.1;
    if (totalLoss > 25) confidence += 0.1;

    // Higher confidence for recent discrepancies
    const recentLosses = unexplainedLosses.filter(loss => 
      new Date(loss.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentLosses.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  // Enhanced alert generation with theft-specific alerts
  static async generateTheftAlerts() {
    try {
      const theftAnomalies = await Anomaly.find({ 
        type: { $in: ['low_stock', 'unusual_pattern', 'expiry_warning', 'high_variance', 'stock_discrepancy','potential_theft','unauthorized_access_pattern','security'] },
        // resolved: false 
      }).populate('productId', 'name category price');

      const alerts = [];
      
      for (const anomaly of theftAnomalies) {
        const existingAlert = await Alert.findOne({
          type: 'security',
          productId: anomaly.productId?._id || null,
          createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
        });

        if (!existingAlert) {
          alerts.push({
            type: 'security',
            title: `🚨 SECURITY ALERT: ${anomaly.type.replace(/_/g, ' ').toUpperCase()}`,
            message: anomaly.productId 
              ? `${anomaly.productId.name}: ${anomaly.description}`
              : anomaly.description,
            severity: 'error',
            productId: anomaly.productId?._id || null,
            metadata: {
              anomalyId: anomaly._id,
              confidence: anomaly.aiConfidence,
              detectionType: 'theft_prevention'
            }
          });
        }
      }

      if (alerts.length > 0) {
        await Alert.insertMany(alerts);
        console.log(`🚨 Generated ${alerts.length} security alerts`);
      }

      return alerts;
    } catch (error) {
      console.error('❌ Error generating theft alerts:', error);
      return [];
    }
  }
}


// API Routes

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, sortBy = 'name', order = 'asc' } = req.query;
    
    let filter = {};
    if (category) filter.category = new RegExp(category, 'i');
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') }
      ];
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj = { [sortBy]: sortOrder };

    const products = await Product.find(filter).sort(sortObj);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  // console.log(req.body)
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock Management Routes
app.post('/api/products/:id/stock', async (req, res) => {
  try {
    const { quantity, type, reason } = req.body;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const previousQuantity = product.quantity;
    const quantityChange = (type === 'sale' || type === 'expiry' || type === 'damage') ? -Math.abs(quantity) : Math.abs(quantity);
    const newQuantity = Math.max(0, previousQuantity + quantityChange);

    // Create transaction record
    const transaction = new Transaction({
      productId,
      type,
      quantity: quantityChange,
      previousQuantity,
      newQuantity,
      reason,
      userId: req.headers['user-id'] || 'system'
    });

    await transaction.save();

    // Update product quantity
    product.quantity = newQuantity;
    await product.save();

    res.json({
      product,
      transaction,
      message: `Stock ${type} recorded successfully`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Transactions Routes
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
    // if (resolved !== undefined) filter.resolved = resolved === 'true';
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

// Alerts Routes
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

// Analytics Routes
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

// AI Detection Trigger Route
app.post('/api/ai/detect-anomalies', async (req, res) => {
  try {
    const anomalies = await EnhancedAIAnomalyDetector.detectAnomalies();
    const alerts = await EnhancedAIAnomalyDetector.generateTheftAlerts();
  
    // console.log('anomalies',anomalies)
    // console.log('alerts',alerts)

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

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});




// Get theft analytics
app.get('/api/analytics/theft', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const theftAnomalies = await Anomaly?.find({
      type: { $in: ['low_stock', 'unusual_pattern', 'expiry_warning', 'high_variance', 'stock_discrepancy','potential_theft','unauthorized_access_pattern','security'] },
      createdAt: { $gte: startDate }
    }).populate('productId', 'name category price');

    const totalIncidents = theftAnomalies?.length;
    const resolvedIncidents = theftAnomalies?.filter(a => a.resolved).length;
    
    // Calculate estimated losses
    const estimatedLoss = theftAnomalies?.reduce((total, anomaly) => {
      const lossValue = anomaly?.metadata?.estimatedValue || anomaly?.metadata?.totalValue || 0;
      return total + lossValue;
    }, 0);

    // High-risk products (products with multiple theft incidents)
    const productRisk = {};
    theftAnomalies?.forEach(anomaly => {
      if (anomaly.productId) {
        const productId = anomaly?.productId?._id.toString();
        productRisk[productId] = (productRisk[productId] || 0) + 1;
      }
    });

    const highRiskProducts = Object.entries(productRisk)
      .filter(([_, count]) => count > 1)
      .map(([productId, count]) => {
        const anomaly = theftAnomalies?.find(a => a.productId?._id.toString() === productId);
        return {
          productId,
          productName: anomaly.productId.name,
          incidentCount: count,
          category: anomaly.productId.category
        };
      });

    res.json({
      totalIncidents,
      resolvedIncidents,
      activeIncidents: totalIncidents - resolvedIncidents,
      estimatedLoss,
      highRiskProducts,
      recentIncidents: theftAnomalies.slice(0, 10),
      analysisWindow: `${days} days`
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
});


// Enhanced detection trigger with theft focus
app.post('/api/ai/detect-theft', async (req, res) => {
  try {
    console.log('🔍 Running focused theft detection...');
    
    const anomalies = await EnhancedAIAnomalyDetector.detectAnomalies();
    const theftAlerts = await EnhancedAIAnomalyDetector.generateTheftAlerts();
    // console.log(anomalies)
    // console.log(theftAlerts)
    
    const theftAnomalies = anomalies.filter(a => 
      ['potential_theft', 'inventory_shrinkage', 'unauthorized_access_pattern', 'organized_theft_pattern']
      .includes(a.type)
    );

    res.json({
      message: 'Theft detection completed',
      totalAnomaliesDetected: anomalies.length,
      theftAnomaliesDetected: theftAnomalies.length,
      alertsGenerated: theftAlerts.length,
      theftAnomalies: theftAnomalies,
      recommendedActions: generateTheftRecommendations(theftAnomalies),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);



// Generate recommendations based on detected theft patterns
function generateTheftRecommendations(theftAnomalies) {
  const recommendations = [];
  
  theftAnomalies.forEach(anomaly => {
    switch (anomaly.type) {
      case 'security':
        recommendations.push({
          priority: 'high',
          action: 'Investigate immediate stock discrepancy',
          product: anomaly.productId,
          details: 'Check security cameras, verify recent transactions, conduct physical inventory count'
        });
        break;
      case 'potential_theft':
        recommendations.push({
          priority: 'high',
          action: 'Investigate immediate stock discrepancy',
          product: anomaly.productId,
          details: 'Check security cameras, verify recent transactions, conduct physical inventory count'
        });
        break;
      case 'inventory_shrinkage':
        recommendations.push({
          priority: 'medium',
          action: 'Implement enhanced inventory controls',
          product: anomaly.productId,
          details: 'Consider more frequent audits, improve access controls, review handling procedures'
        });
        break;
      case 'unauthorized_access_pattern':
        recommendations.push({
          priority: 'high',
          action: 'Review user access and security protocols',
          product: anomaly.productId,
          details: 'Audit user permissions, check after-hours access logs, enhance authentication'
        });
        break;
      case 'organized_theft_pattern':
        recommendations.push({
          priority: 'critical',
          action: 'Alert security/management immediately',
          product: null,
          details: 'Potential organized theft detected across multiple high-value items - requires immediate investigation'
        });
        break;
    }
  });
  
  return recommendations;
}


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});




// 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({ error: 'Route not found' });
// });
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Scheduled AI anomaly detection (every 30 minutes)
setInterval(async () => {
  console.log('🕐 Running scheduled anomaly detection...');
  await EnhancedAIAnomalyDetector.detectAnomalies();
  await EnhancedAIAnomalyDetector.generateTheftAlerts();
}, 30 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      // console.log(`🚀 Server running on port ${PORT}`);
      // console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
      // console.log(`🤖 AI Detection: http://localhost:${PORT}/api/ai/detect-anomalies`);
      
      // Run initial anomaly detection
      setTimeout(async () => {
        console.log('🔍 Running initial anomaly detection...');
        
        await EnhancedAIAnomalyDetector.detectAnomalies();
        await EnhancedAIAnomalyDetector.generateTheftAlerts();
      }, 5000);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  });
});

startServer();