const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for creating ProductType
const createProductTypeSchema = z.object({
  productTypeName: z.string().min(1, 'Product type name is required'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  isActive: z.boolean().optional()
});

// Zod schema for updating ProductType
const updateProductTypeSchema = z.object({
  productTypeName: z.string().min(1, 'Product type name is required').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  isActive: z.boolean().optional()
}).strict();

const productTypeSchema = new mongoose.Schema({
  productTypeName: {
    type: String,
    required: true,
    unique: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
}, { timestamps: true });

const ProductType = mongoose.model('ProductType', productTypeSchema);

module.exports = ProductType;
module.exports.createProductTypeSchema = createProductTypeSchema;
module.exports.updateProductTypeSchema = updateProductTypeSchema;