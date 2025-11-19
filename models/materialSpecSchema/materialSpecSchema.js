const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for dimension item
const dimensionItemZodSchema = z.object({
  name: z.string().min(1, 'Dimension name is required'),
  value: z.any(),
  unit: z.string().optional(),
  dataType: z.enum(['string', 'number', 'boolean', 'date']).default('string'),
  formula: z.string().optional(), // Formula string (e.g., "weight * height")
  isCalculated: z.boolean().optional().default(false) // Flag for calculated fields
});

// Zod schema for creating MaterialSpec
const createMaterialSpecSchema = z.object({
  materialTypeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialTypeId format'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  specName: z.string().min(1, 'Spec name is required'),
  description: z.string().default(''),
  mol: z.number().nonnegative().optional(),
  weightPerPiece: z.number().nonnegative().optional(),
  density: z.number().nonnegative().optional(),
  dimensions: z.array(dimensionItemZodSchema).optional(),
  isActive: z.boolean().optional()
});

// Zod schema for updating MaterialSpec
const updateMaterialSpecSchema = z.object({
  materialTypeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialTypeId format').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  specName: z.string().min(1, 'Spec name is required').optional(),
  description: z.string().optional(),
  mol: z.number().nonnegative().optional(),
  weightPerPiece: z.number().nonnegative().optional(),
  density: z.number().nonnegative().optional(),
  dimensions: z.array(dimensionItemZodSchema).optional(),
  isActive: z.boolean().optional()
}).strict();

const materialSpecSchema = new mongoose.Schema({
  materialTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialType',
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

  // Material Properties
  mol: {
    type: Number,
    default: 0,
    comment: 'Molecular weight or Material MOL value'
  },

  weightPerPiece: {
    type: Number,
    default: 0,
    comment: 'Weight per single piece in grams'
  },

  density: {
    type: Number,
    default: 0,
    comment: 'Density in g/cm³'
  },

  // Generic dimensions for additional properties
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
      comment: 'Formula string referencing other dimensions (e.g., "weight * height")'
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
// UNIQUE constraint: Each material type can have only ONE specification per branch
materialSpecSchema.index({ materialTypeId: 1, branchId: 1 }, { unique: true });
materialSpecSchema.index({ isActive: 1 });
materialSpecSchema.index({ specName: 1, branchId: 1 });

const MaterialSpec = mongoose.model('MaterialSpec', materialSpecSchema);

module.exports = MaterialSpec;
module.exports.createMaterialSpecSchema = createMaterialSpecSchema;
module.exports.updateMaterialSpecSchema = updateMaterialSpecSchema;
module.exports.dimensionItemZodSchema = dimensionItemZodSchema;
