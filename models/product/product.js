const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a new product
const createProductSchema = z.object({
  productName: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Product name must be less than 200 characters'),
  productType: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid productType ID format'),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  isActive: z.boolean()
    .optional()
    .default(true)
});

// Zod schema for updating a product
const updateProductSchema = z.object({
  productName: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Product name must be less than 200 characters')
    .optional(),
  productType: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid productType ID format')
    .optional(),
  isActive: z.boolean()
    .optional()
});

// Zod schema for product ID parameter
const productIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true, unique: true },
  productType: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType', required: true },
  
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ============================================================================
// EXPORTS
// ============================================================================

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
module.exports.createProductSchema = createProductSchema;
module.exports.updateProductSchema = updateProductSchema;
module.exports.productIdSchema = productIdSchema;