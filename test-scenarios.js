const axios = require('axios');

class InventorySystemTester {
  constructor(baseURL) {
    this.baseURL = baseURL || 'http://localhost:5001';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Helper method to log test results
  logTestResult(testName, success, message = '') {
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${testName}${message ? ': ' + message : ''}`);
    return success;
  }

  // Test 1: Basic Product Management
  async testProductManagement() {
    console.log('\n=== Testing Product Management ===');
    
    try {
      // Create a product
      const productData = {
        name: 'Test Product',
        category: 'Electronics',
        quantity: 100,
        minimumStock: 10,
        price: 99.99,
        currency: 'USD'
      };
      
      const createResponse = await this.axiosInstance.post('/api/products', productData);
      const productId = createResponse.data._id;
      
      if (!productId) {
        return this.logTestResult('Create Product', false, 'No product ID returned');
      }
      
      this.logTestResult('Create Product', true, `Product ID: ${productId}`);
      
      // Get the product
      const getResponse = await this.axiosInstance.get(`/api/products/${productId}`);
      this.logTestResult('Get Product', getResponse.data._id === productId);
      
      // Update the product
      const updateResponse = await this.axiosInstance.put(`/api/products/${productId}`, {
        quantity: 150,
        price: 129.99
      });
      
      this.logTestResult('Update Product', 
        updateResponse.data.quantity === 150 && updateResponse.data.price === 129.99);
      
      // Get all products
      const allProductsResponse = await this.axiosInstance.get('/api/products');
      this.logTestResult('Get All Products', Array.isArray(allProductsResponse.data));
      
      return productId;
    } catch (error) {
      return this.logTestResult('Product Management', false, error.message);
    }
  }

  // Test 2: Stock Transactions
  async testStockTransactions(productId) {
    console.log('\n=== Testing Stock Transactions ===');
    
    try {
      // Record a sale
      const saleResponse = await this.axiosInstance.post(`/api/products/${productId}/stock`, {
        quantity: 5,
        type: 'sale',
        reason: 'Customer purchase'
      });
      
      this.logTestResult('Record Sale', saleResponse.data.product.quantity === 145);
      
      // Record a restock
      const restockResponse = await this.axiosInstance.post(`/api/products/${productId}/stock`, {
        quantity: 20,
        type: 'restock',
        reason: 'Supplier delivery'
      });
      
      this.logTestResult('Record Restock', restockResponse.data.product.quantity === 165);
      
      // Get transaction history
      const transactionsResponse = await this.axiosInstance.get('/api/transactions');
      this.logTestResult('Get Transactions', 
        Array.isArray(transactionsResponse.data) && transactionsResponse.data.length >= 2);
      
      return true;
    } catch (error) {
      return this.logTestResult('Stock Transactions', false, error.message);
    }
  }

  // Test 3: Low Stock Detection
  async testLowStockDetection(productId) {
    console.log('\n=== Testing Low Stock Detection ===');
    
    try {
      // Set stock to low level
      await this.axiosInstance.put(`/api/products/${productId}`, {
        quantity: 5,
        minimumStock: 10
      });
      
      // Trigger anomaly detection
      const detectionResponse = await this.axiosInstance.post('/api/ai/detect-anomalies');
      
      // Check for low stock anomalies
      const anomaliesResponse = await this.axiosInstance.get('/api/anomalies?type=low_stock&resolved=false');
      const hasLowStockAnomaly = anomaliesResponse.data.some(anomaly => 
        anomaly.productId._id === productId && anomaly.type === 'low_stock'
      );
      
      this.logTestResult('Low Stock Detection', hasLowStockAnomaly);
      
      return hasLowStockAnomaly;
    } catch (error) {
      return this.logTestResult('Low Stock Detection', false, error.message);
    }
  }

  // Test 4: Theft Detection - Unexplained Discrepancies
  async testTheftDetection(productId) {
    console.log('\n=== Testing Theft Detection ===');
    
    try {
      // Set initial stock
      await this.axiosInstance.put(`/api/products/${productId}`, {
        quantity: 100
      });
      
      // Create some legitimate transactions
      await this.axiosInstance.post(`/api/products/${productId}/stock`, {
        quantity: 10,
        type: 'sale',
        reason: 'Customer purchase'
      });
      
      // Now manually reduce stock to simulate theft (bypassing transactions)
      await this.axiosInstance.put(`/api/products/${productId}`, {
        quantity: 80  // Should be 90 if only the sale occurred
      });
      
      // Trigger theft detection
      const detectionResponse = await this.axiosInstance.post('/api/ai/detect-theft');
      
      // Check for theft anomalies
      const anomaliesResponse = await this.axiosInstance.get('/api/anomalies?type=potential_theft&resolved=false');
      const hasTheftAnomaly = anomaliesResponse.data.some(anomaly => 
        anomaly.productId._id === productId && anomaly.type === 'potential_theft'
      );
      
      this.logTestResult('Theft Detection', hasTheftAnomaly);
      
      return hasTheftAnomaly;
    } catch (error) {
      return this.logTestResult('Theft Detection', false, error.message);
    }
  }

  // Test 5: Inventory Shrinkage Detection
  async testShrinkageDetection(productId) {
    console.log('\n=== Testing Inventory Shrinkage Detection ===');
    
    try {
      // Set initial stock
      await this.axiosInstance.put(`/api/products/${productId}`, {
        quantity: 200,
        price: 49.99
      });
      
      // Create multiple small sales over time
      for (let i = 0; i < 15; i++) {
        await this.axiosInstance.post(`/api/products/${productId}/stock`, {
          quantity: 2,
          type: 'sale',
          reason: 'Customer purchase'
        });
        
        // Simulate small unexplained losses (shrinkage)
        if (i % 3 === 0) {
          const currentProduct = await this.axiosInstance.get(`/api/products/${productId}`);
          const currentQty = currentProduct.data.quantity;
          
          // Reduce stock by 1 unit without transaction (simulating shrinkage)
          await this.axiosInstance.put(`/api/products/${productId}`, {
            quantity: currentQty - 1
          });
        }
      }
      
      // Trigger anomaly detection
      await this.axiosInstance.post('/api/ai/detect-anomalies');
      
      // Check for shrinkage anomalies
      const anomaliesResponse = await this.axiosInstance.get('/api/anomalies?type=inventory_shrinkage&resolved=false');
      const hasShrinkageAnomaly = anomaliesResponse.data.some(anomaly => 
        anomaly.productId._id === productId && anomaly.type === 'inventory_shrinkage'
      );
      
      this.logTestResult('Shrinkage Detection', hasShrinkageAnomaly);
      
      return hasShrinkageAnomaly;
    } catch (error) {
      return this.logTestResult('Shrinkage Detection', false, error.message);
    }
  }

  // Test 6: Unauthorized Access Pattern Detection
  async testUnauthorizedAccessDetection(productId) {
    console.log('\n=== Testing Unauthorized Access Detection ===');
    
    try {
      // Simulate after-hours transactions by manually setting timestamps
      // This would typically require direct database manipulation
      // For API testing, we'll use the header to simulate different users
      
      // Make multiple transactions with the same user ID
      const userId = 'suspicious_user_123';
      
      for (let i = 0; i < 12; i++) {
        await this.axiosInstance.post(`/api/products/${productId}/stock`, {
          quantity: 1,
          type: 'sale',
          reason: 'Customer purchase'
        }, {
          headers: { 'user-id': userId }
        });
      }
      
      // Trigger anomaly detection
      await this.axiosInstance.post('/api/ai/detect-anomalies');
      
      // Check for unauthorized access anomalies
      const anomaliesResponse = await this.axiosInstance.get('/api/anomalies?type=unauthorized_access_pattern&resolved=false');
      const hasAccessAnomaly = anomaliesResponse.data.length > 0;
      
      this.logTestResult('Unauthorized Access Detection', hasAccessAnomaly);
      
      return hasAccessAnomaly;
    } catch (error) {
      return this.logTestResult('Unauthorized Access Detection', false, error.message);
    }
  }

  // Test 7: Alert Generation
  async testAlertGeneration() {
    console.log('\n=== Testing Alert Generation ===');
    
    try {
      // Get current alerts
      const alertsResponse = await this.axiosInstance.get('/api/alerts?read=false');
      const initialAlertCount = alertsResponse.data.length;
      
      // Trigger anomaly detection to generate new alerts
      await this.axiosInstance.post('/api/ai/detect-anomalies');
      
      // Check for new alerts
      const newAlertsResponse = await this.axiosInstance.get('/api/alerts?read=false');
      const hasNewAlerts = newAlertsResponse.data.length > initialAlertCount;
      
      this.logTestResult('Alert Generation', hasNewAlerts);
      
      // Test marking alert as read
      if (newAlertsResponse.data.length > 0) {
        const alertId = newAlertsResponse.data[0]._id;
        const readResponse = await this.axiosInstance.put(`/api/alerts/${alertId}/read`);
        this.logTestResult('Mark Alert as Read', readResponse.data.read === true);
      }
      
      return hasNewAlerts;
    } catch (error) {
      return this.logTestResult('Alert Generation', false, error.message);
    }
  }

  // Test 8: Analytics Endpoints
  async testAnalytics() {
    console.log('\n=== Testing Analytics Endpoints ===');
    
    try {
      // Test dashboard analytics
      const dashboardResponse = await this.axiosInstance.get('/api/analytics/dashboard');
      const hasDashboardData = dashboardResponse.data && 
                              typeof dashboardResponse.data.totalProducts === 'number';
      
      this.logTestResult('Dashboard Analytics', hasDashboardData);
      
      // Test theft analytics
      const theftResponse = await this.axiosInstance.get('/api/analytics/theft?days=30');
      const hasTheftData = theftResponse.data && 
                          typeof theftResponse.data.totalIncidents === 'number';
      
      this.logTestResult('Theft Analytics', hasTheftData);
      
      return hasDashboardData && hasTheftData;
    } catch (error) {
      return this.logTestResult('Analytics', false, error.message);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('Starting comprehensive inventory system tests...\n');
    
    try {
      // Test basic product management and get a product ID for subsequent tests
      const productId = await this.testProductManagement();
      
      if (!productId) {
        console.log('❌ Cannot proceed with tests without a valid product ID');
        return false;
      }
      
      // Run all tests
      await this.testStockTransactions(productId);
      await this.testLowStockDetection(productId);
      await this.testTheftDetection(productId);
      await this.testShrinkageDetection(productId);
      await this.testUnauthorizedAccessDetection(productId);
      await this.testAlertGeneration();
      await this.testAnalytics();
      
      console.log('\n=== Test Summary ===');
      console.log('All tests completed. Review results above.');
      
      // Clean up - delete test product
      try {
        await this.axiosInstance.delete(`/api/products/${productId}`);
        console.log('🧹 Cleanup: Test product deleted');
      } catch (error) {
        console.log('⚠️  Cleanup failed: Could not delete test product');
      }
      
    } catch (error) {
      console.log('❌ Test suite failed:', error.message);
    }
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const tester = new InventorySystemTester(process.env.API_BASE_URL);
  tester.runAllTests();
}

module.exports = InventorySystemTester;


