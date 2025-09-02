const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

const productValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 100 })
    .withMessage('Product name must not exceed 100 characters'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters'),
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date'),
  body('minimumStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock must be a non-negative integer')
];

const stockUpdateValidation = [
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('type')
    .isIn(['sale', 'restock', 'adjustment', 'expiry', 'damage'])
    .withMessage('Invalid transaction type'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must not exceed 200 characters')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

module.exports = {
  handleValidationErrors,
  productValidation,
  stockUpdateValidation,
  idValidation
};