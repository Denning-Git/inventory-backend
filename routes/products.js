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


app.post('/api/products/:id/stock', async (req, res) => {
  try {
    const { quantity, type, reason } = req.body;
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const previousQuantity = product.quantity;
    const quantityChange = type === 'sale' ? -Math.abs(quantity) : Math.abs(quantity);
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