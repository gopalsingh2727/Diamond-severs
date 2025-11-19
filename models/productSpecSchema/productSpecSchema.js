const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for dimension item
const dimensionItemZodSchema = z.object({
  name: z.string().min(1, 'Dimension name is required'),
  value: z.any(),
  unit: z.string().optional(),
  dataType: z.enum(['string', 'number', 'boolean', 'date']).default('string'),
  formula: z.string().optional(), // Formula string (e.g., "length * width")
  isCalculated: z.boolean().optional().default(false) // Flag for calculated fields
});

// Zod schema for creating ProductSpec
const createProductSpecSchema = z.object({
  productTypeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productTypeId format'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  specName: z.string().min(1, 'Spec name is required'),
  description: z.string().default(''),
  dimensions: z.array(dimensionItemZodSchema).optional(),
  isActive: z.boolean().optional()
});

// Zod schema for updating ProductSpec
const updateProductSpecSchema = z.object({
  productTypeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productTypeId format').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  specName: z.string().min(1, 'Spec name is required').optional(),
  description: z.string().optional(),
  dimensions: z.array(dimensionItemZodSchema).optional(),
  isActive: z.boolean().optional()
}).strict();

const productSpecSchema = new mongoose.Schema({
  productTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductType',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

  specName: {
    type: String,
    required: true
  },

  description: {
    type: String,
    default: ''
  },

  dimensions: [{
    name: { type: String, required: true },
    value: mongoose.Schema.Types.Mixed,
    unit: String,
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date'],
      default: 'string'
    },
    formula: {
      type: String,
      default: null,
      comment: 'Formula string referencing other dimensions (e.g., "length * width")'
    },
    isCalculated: {
      type: Boolean,
      default: false,
      comment: 'Flag indicating if this dimension is auto-calculated from a formula'
    }
  }],

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
// UNIQUE constraint: Each product type can have only ONE specification per branch
productSpecSchema.index({ productTypeId: 1, branchId: 1 }, { unique: true });
productSpecSchema.index({ isActive: 1 });
productSpecSchema.index({ specName: 1, branchId: 1 });

const ProductSpec = mongoose.model('ProductSpec', productSpecSchema);

module.exports = ProductSpec;
module.exports.createProductSpecSchema = createProductSpecSchema;
module.exports.updateProductSpecSchema = updateProductSpecSchema;
module.exports.dimensionItemZodSchema = dimensionItemZodSchema;
