const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for material formula item
const materialFormulaItemZodSchema = z.object({
  materialId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format'),
  materialName: z.string().min(1, 'Material name is required'),
  percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage cannot exceed 100'),
  weightPerUnit: z.number().positive('Weight per unit must be positive'),
  isOptional: z.boolean().optional()
});

// Zod schema for creating MaterialFormula
const createMaterialFormulaSchema = z.object({
  formulaName: z.string().min(1, 'Formula name is required'),
  productSpecId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format').optional(),
  productType: z.string().min(1, 'Product type is required'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  materials: z.array(materialFormulaItemZodSchema).min(1, 'At least one material is required'),
  totalPercentage: z.number().optional(),
  mixingTimeMinutes: z.number().min(0, 'Mixing time must be at least 0').default(0),
  mixingTemperature: z.number().default(0),
  mixingSpeed: z.enum(['slow', 'medium', 'fast']).default('medium'),
  expectedOutput: z.number().min(0).max(100).default(95),
  expectedWastage: z.number().min(0).max(100).default(5),
  minBatchSize: z.number().positive('Min batch size must be positive').default(10),
  maxBatchSize: z.number().positive('Max batch size must be positive').default(500),
  isActive: z.boolean().optional(),
  version: z.number().int().positive().optional(),
  notes: z.string().optional(),
  createdBy: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid createdBy format').optional(),
  createdByRole: z.enum(['Admin', 'Manager', 'MasterAdmin']).optional()
}).refine(data => !data.maxBatchSize || !data.minBatchSize || data.maxBatchSize >= data.minBatchSize, {
  message: 'Max batch size must be greater than or equal to min batch size',
  path: ['maxBatchSize']
});

// Zod schema for updating MaterialFormula
const updateMaterialFormulaSchema = z.object({
  formulaName: z.string().min(1, 'Formula name is required').optional(),
  productSpecId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format').optional(),
  productType: z.string().min(1, 'Product type is required').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  materials: z.array(materialFormulaItemZodSchema).min(1, 'At least one material is required').optional(),
  totalPercentage: z.number().optional(),
  mixingTimeMinutes: z.number().min(0, 'Mixing time must be at least 0').optional(),
  mixingTemperature: z.number().optional(),
  mixingSpeed: z.enum(['slow', 'medium', 'fast']).optional(),
  expectedOutput: z.number().min(0).max(100).optional(),
  expectedWastage: z.number().min(0).max(100).optional(),
  minBatchSize: z.number().positive('Min batch size must be positive').optional(),
  maxBatchSize: z.number().positive('Max batch size must be positive').optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive().optional(),
  notes: z.string().optional(),
  createdBy: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid createdBy format').optional(),
  createdByRole: z.enum(['Admin', 'Manager', 'MasterAdmin']).optional()
}).strict();

const materialFormulaItemSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  weightPerUnit: {
    type: Number,  // grams per unit (e.g., per 1000 bags)
    required: true
  },
  isOptional: {
    type: Boolean,
    default: false
  }
});

const materialFormulaSchema = new mongoose.Schema({
  formulaName: {
    type: String,
    required: true
  },
  productSpecId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductSpec'
  },
  productType: {
    type: String,
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

  // Material composition
  materials: [materialFormulaItemSchema],

  // Total must equal 100%
  totalPercentage: {
    type: Number,
    default: 100,
    validate: {
      validator: function(v) {
        return v === 100;
      },
      message: 'Total percentage must equal 100%'
    }
  },

  // Mixing specifications
  mixingTimeMinutes: {
    type: Number,
    required: true,
    default: 0
  },
  mixingTemperature: {
    type: Number,  // Celsius
    default: 0
  },
  mixingSpeed: {
    type: String,
    enum: ['slow', 'medium', 'fast'],
    default: 'medium'
  },

  // Quality parameters
  expectedOutput: {
    type: Number,  // Expected yield percentage
    default: 95
  },
  expectedWastage: {
    type: Number,  // Expected waste percentage
    default: 5
  },

  // Batch information
  minBatchSize: {
    type: Number,  // kg
    default: 10
  },
  maxBatchSize: {
    type: Number,  // kg
    default: 500
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },

  // Metadata
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByRole'
  },
  createdByRole: {
    type: String,
    enum: ['Admin', 'Manager', 'MasterAdmin']
  }
}, {
  timestamps: true
});

// Indexes for better performance
materialFormulaSchema.index({ productSpecId: 1, branchId: 1 });
materialFormulaSchema.index({ productType: 1, branchId: 1 });
materialFormulaSchema.index({ isActive: 1 });
materialFormulaSchema.index({ formulaName: 1, branchId: 1 });

// Calculate total percentage before saving
materialFormulaSchema.pre('save', function(next) {
  this.totalPercentage = this.materials.reduce((sum, m) => sum + m.percentage, 0);
  next();
});

// Virtual for formula display
materialFormulaSchema.virtual('formulaDescription').get(function() {
  return `${this.formulaName} (${this.materials.length} materials, ${this.mixingTimeMinutes} min mixing)`;
});

// Method to calculate material requirements for a given quantity
materialFormulaSchema.methods.calculateRequirements = function(quantity) {
  const requirements = this.materials.map(m => {
    const requiredWeight = (m.weightPerUnit * quantity) / 1000; // Convert to kg
    return {
      materialId: m.materialId,
      materialName: m.materialName,
      percentage: m.percentage,
      requiredWeight,
      unit: 'kg'
    };
  });

  const totalWeight = requirements.reduce((sum, r) => sum + r.requiredWeight, 0);

  return {
    formula: {
      id: this._id,
      name: this.formulaName
    },
    quantity,
    totalWeight,
    requirements,
    mixingTime: this.mixingTimeMinutes,
    expectedWastage: (totalWeight * this.expectedWastage) / 100
  };
};

const MaterialFormula = mongoose.model('MaterialFormula', materialFormulaSchema);

module.exports = MaterialFormula;
module.exports.createMaterialFormulaSchema = createMaterialFormulaSchema;
module.exports.updateMaterialFormulaSchema = updateMaterialFormulaSchema;
module.exports.materialFormulaItemZodSchema = materialFormulaItemZodSchema;
