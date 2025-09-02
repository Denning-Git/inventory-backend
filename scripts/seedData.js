const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-ai');
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Product Schema (simplified for seeding)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  expiryDate: { type: Date, default: null },
  minimumStock: { type: Number, default: 10 }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

const sampleProducts = [
  {
    name: 'White Rice 1kg',
    category: 'Grains & Cereals',
    quantity: 45,
    price: 1200,
    expiryDate: new Date('2025-12-31'),
    minimumStock: 20
  },
  {
    name: 'Cooking Oil 500ml',
    category: 'Cooking Essentials',
    quantity: 23,
    price: 800,
    expiryDate: new Date('2025-10-15'),
    minimumStock: 15
  },
  {
    name: 'Soap Bar',
    category: 'Personal Care',
    quantity: 67,
    price: 300,
    expiryDate: null,
    minimumStock: 25
  },
  {
    name: 'Sugar 1kg',
    category: 'Sweeteners',
    quantity: 12,
    price: 900,
    expiryDate: new Date('2026-01-20'),
    minimumStock: 30
  },
  {
    name: 'Toothpaste',
    category: 'Personal Care',
    quantity: 8,
    price: 600,
    expiryDate: new Date('2025-09-30'),
    minimumStock: 15
  },
  {
    name: 'Maize Flour 1kg',
    category: 'Grains & Cereals',
    quantity: 35,
    price: 1000,
    expiryDate: new Date('2025-11-15'),
    minimumStock: 25
  },
  {
    name: 'Tea Leaves 250g',
    category: 'Beverages',
    quantity: 28,
    price: 450,
    expiryDate: new Date('2026-03-10'),
    minimumStock: 20
  },
  {
    name: 'Detergent Powder 500g',
    category: 'Cleaning Supplies',
    quantity: 41,
    price: 1500,
    expiryDate: null,
    minimumStock: 15
  },
  {
    name: 'Salt 1kg',
    category: 'Seasonings',
    quantity: 22,
    price: 300,
    expiryDate: null,
    minimumStock: 20
  },
  {
    name: 'Milk Powder 400g',
    category: 'Dairy Products',
    quantity: 18,
    price: 1800,
    expiryDate: new Date('2025-08-30'),
    minimumStock: 12
  },
  {
    name: 'Groundnut Oil 1L',
    category: 'Cooking Essentials',
    quantity: 15,
    price: 1600,
    expiryDate: new Date('2025-12-01'),
    minimumStock: 10
  },
  {
    name: 'Biscuits Pack',
    category: 'Snacks',
    quantity: 55,
    price: 200,
    expiryDate: new Date('2025-10-20'),
    minimumStock: 30
  },
  {
    name: 'Shampoo 200ml',
    category: 'Personal Care',
    quantity: 31,
    price: 800,
    expiryDate: new Date('2026-05-15'),
    minimumStock: 18
  },
  {
    name: 'Beans 1kg',
    category: 'Legumes',
    quantity: 40,
    price: 1400,
    expiryDate: new Date('2026-02-28'),
    minimumStock: 25
  },
  {
    name: 'Tissue Paper Pack',
    category: 'Personal Care',
    quantity: 60,
    price: 250,
    expiryDate: null,
    minimumStock: 35
  }
];

const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');
    
    // Insert sample products
    await Product.insertMany(sampleProducts);
    console.log(`✅ Seeded ${sampleProducts.length} sample products`);
    
    console.log('🌱 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();