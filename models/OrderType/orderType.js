const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Custom field schema for dynamic fields
const customFieldZodSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  fieldLabel: z.string().min(1, 'Field label is required'),
  fieldType: z.enum(['text', 'number', 'boolean', 'date', 'select']),
  required: z.boolean().optional().default(false),
  defaultValue: z.any().optional(),
  selectOptions: z.array(z.string()).optional(),
  placeholder: z.string().optional()
});

// Validation rules schema
const validationRulesZodSchema = z.object({
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
  allowedProductTypes: z.array(z.string()).optional(),
  allowedMaterialTypes: z.array(z.string()).optional(),
  requiresCustomerApproval: z.boolean().optional().default(false),
  maxPriorityLevel: z.number().min(1).max(5).optional()
});

// SLA configuration schema
const slaConfigZodSchema = z.object({
  standardTurnaroundDays: z.number().optional(),
  urgentTurnaroundDays: z.number().optional(),
  autoEscalateAfterDays: z.number().optional(),
  sendReminderBeforeDays: z.number().optional()
});

// Costing parameters schema
const costingParamsZodSchema = z.object({
  basePrice: z.number().optional(),
  priceMultiplier: z.number().optional().default(1),
  additionalCharges: z.number().optional().default(0),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(100).optional()
});

// Form field configuration schema
const formFieldZodSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'number', 'select', 'suggestions']),
  required: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(true)
});

// Form section configuration schema
const formSectionZodSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  name: z.string().min(1, 'Section name is required'),
  enabled: z.boolean().optional().default(true),
  order: z.number().int().min(1).optional().default(1),
  fields: z.array(formFieldZodSchema).optional().default([])
});

// Restrictions schema for Zod
const restrictionsZodSchema = z.object({
  allowedProductTypes: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
  allowedMaterialTypes: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
  allowedMachines: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([]),
  allowedMachineTypes: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional().default([])
}).optional();

// Machine workflow schema for Zod - simplified to single default machine
const machineWorkflowZodSchema = z.object({
  defaultMachineId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  defaultMachineTypeId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
}).optional();

// Zod schema for creating an order type
const createOrderTypeSchema = z.object({
  typeName: z.string()
    .min(1, 'Order type name is required')
    .max(100, 'Type name must be less than 100 characters')
    .trim(),
  typeCode: z.string()
    .min(1, 'Type code is required')
    .max(20, 'Type code must be less than 20 characters')
    .toUpperCase()
    .trim(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
    .default(''),

  // Numbering configuration
  numberPrefix: z.string()
    .min(1, 'Number prefix is required')
    .max(10, 'Number prefix must be less than 10 characters')
    .toUpperCase()
    .trim(),
  numberFormat: z.string()
    .optional()
    .default('{PREFIX}-{SEQUENCE}'),
  sequenceCounter: z.number()
    .int()
    .min(0)
    .optional()
    .default(0),
  sequencePadding: z.number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .default(4),

  // Auto-configuration
  defaultSteps: z.array(z.string()).optional().default([]),

  // Custom fields and validation
  customFields: z.array(customFieldZodSchema).optional().default([]),
  validationRules: validationRulesZodSchema.optional(),

  // SLA and costing
  slaConfig: slaConfigZodSchema.optional(),
  costingParams: costingParamsZodSchema.optional(),

  // Workflow settings
  requiresApproval: z.boolean().optional().default(false),
  approvalLevels: z.number().int().min(1).max(5).optional().default(1),
  autoApproveBelow: z.number().optional(),

  // Branch association
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID format')
    .optional(),
  isGlobal: z.boolean()
    .optional()
    .default(false),

  // Status
  isActive: z.boolean()
    .optional()
    .default(true),
  isDefault: z.boolean()
    .optional()
    .default(false),

  // Form sections configuration for dynamic form rendering
  sections: z.array(formSectionZodSchema)
    .optional()
    .default([]),

  // Restrictions
  restrictions: restrictionsZodSchema,

  // Machine workflow
  machineWorkflow: machineWorkflowZodSchema
});

// Zod schema for updating an order type
const updateOrderTypeSchema = z.object({
  typeName: z.string()
    .min(1, 'Order type name is required')
    .max(100, 'Type name must be less than 100 characters')
    .trim()
    .optional(),
  typeCode: z.string()
    .min(1, 'Type code is required')
    .max(20, 'Type code must be less than 20 characters')
    .toUpperCase()
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),

  numberPrefix: z.string()
    .min(1, 'Number prefix is required')
    .max(10, 'Number prefix must be less than 10 characters')
    .toUpperCase()
    .trim()
    .optional(),
  numberFormat: z.string().optional(),
  sequencePadding: z.number()
    .int()
    .min(1)
    .max(4)
    .optional(),

  defaultSteps: z.array(z.string()).optional(),

  customFields: z.array(customFieldZodSchema).optional(),
  validationRules: validationRulesZodSchema.optional(),
  slaConfig: slaConfigZodSchema.optional(),
  costingParams: costingParamsZodSchema.optional(),

  requiresApproval: z.boolean().optional(),
  approvalLevels: z.number().int().min(1).max(5).optional(),
  autoApproveBelow: z.number().optional(),

  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID format')
    .optional(),
  isGlobal: z.boolean().optional(),

  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),

  // Form sections configuration
  sections: z.array(formSectionZodSchema).optional(),

  // Restrictions
  restrictions: restrictionsZodSchema,

  // Machine workflow
  machineWorkflow: machineWorkflowZodSchema
});

// Zod schema for order type ID parameter
const orderTypeIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid order type ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const CustomFieldSchema = new mongoose.Schema({
  fieldName: {
    type: String,
    required: true
  },
  fieldLabel: {
    type: String,
    required: true
  },
  fieldType: {
    type: String,
    enum: ['text', 'number', 'boolean', 'date', 'select'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  selectOptions: [{
    type: String
  }],
  placeholder: {
    type: String
  }
}, { _id: false });

const ValidationRulesSchema = new mongoose.Schema({
  minQuantity: Number,
  maxQuantity: Number,
  allowedProductTypes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory' }],
  allowedMaterialTypes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MaterialType' }],
  requiresCustomerApproval: {
    type: Boolean,
    default: false
  },
  maxPriorityLevel: {
    type: Number,
    min: 1,
    max: 5
  }
}, { _id: false });

const SLAConfigSchema = new mongoose.Schema({
  standardTurnaroundDays: Number,
  urgentTurnaroundDays: Number,
  autoEscalateAfterDays: Number,
  sendReminderBeforeDays: Number
}, { _id: false });

const CostingParamsSchema = new mongoose.Schema({
  basePrice: Number,
  priceMultiplier: {
    type: Number,
    default: 1
  },
  additionalCharges: {
    type: Number,
    default: 0
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  taxRate: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

// Form field configuration schema for dynamic form rendering
const FormFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'select', 'suggestions'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// Form section configuration schema for dynamic form rendering
const FormSectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 1
  },
  fields: [FormFieldSchema]
}, { _id: false });

// Restrictions schema - control what product types, material types, machines can be used
const RestrictionsSchema = new mongoose.Schema({
  // Allowed product types - if empty, all are allowed
  allowedProductTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductType'
  }],
  // Allowed material types - if empty, all are allowed
  allowedMaterialTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialType'
  }],
  // Allowed machines - if empty, all are allowed
  allowedMachines: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine'
  }],
  // Allowed machine types - if empty, all are allowed
  allowedMachineTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineType'
  }]
}, { _id: false });

// Machine workflow configuration schema - simplified to single default machine
const MachineWorkflowSchema = new mongoose.Schema({
  // Default machine for this order type
  defaultMachineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine'
  },
  // Default machine type for this order type
  defaultMachineTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineType'
  }
}, { _id: false });

const OrderTypeSchema = new mongoose.Schema({
  typeName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  typeCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },

  // Numbering configuration
  numberPrefix: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  numberFormat: {
    type: String,
    default: '{PREFIX}-{SEQUENCE}',
    comment: 'Format template for order numbers. Use {PREFIX}, {SEQUENCE}, {BRANCH}, {DATE}'
  },
  sequenceCounter: {
    type: Number,
    default: 0,
    min: 0,
    comment: 'Current sequence number for this order type'
  },
  sequencePadding: {
    type: Number,
    default: 4,
    min: 1,
    max: 4,
    comment: 'Number of digits to pad sequence number (e.g., 4 = 0001)'
  },

  // Auto-configuration
  defaultSteps: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Step'
  }],

  // Custom fields and validation
  customFields: [CustomFieldSchema],
  validationRules: ValidationRulesSchema,

  // SLA and costing
  slaConfig: SLAConfigSchema,
  costingParams: CostingParamsSchema,

  // Workflow settings
  requiresApproval: {
    type: Boolean,
    default: false,
    comment: 'Orders of this type require approval before processing'
  },
  approvalLevels: {
    type: Number,
    min: 1,
    max: 5,
    default: 1,
    comment: 'Number of approval levels required'
  },
  autoApproveBelow: {
    type: Number,
    comment: 'Auto-approve orders below this quantity/value'
  },

  // Branch association
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    index: true,
    comment: 'If set, this order type is only available to this branch'
  },
  isGlobal: {
    type: Boolean,
    default: false,
    comment: 'If true, this order type is available to all branches'
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    comment: 'If true, this is the default order type for new orders'
  },

  // Form sections configuration for dynamic form rendering
  sections: {
    type: [FormSectionSchema],
    default: [],
    comment: 'Configuration of form sections and fields for dynamic order creation form'
  },

  // Restrictions - control what can be used with this order type
  restrictions: {
    type: RestrictionsSchema,
    default: {},
    comment: 'Restrictions on allowed product types, material types, and machines'
  },

  // Machine workflow configuration
  machineWorkflow: {
    type: MachineWorkflowSchema,
    default: {},
    comment: 'Default machine configuration for orders of this type'
  },

  // Versioning - for safe updates without breaking old orders
  version: {
    type: Number,
    default: 1,
    comment: 'Version number of this order type configuration'
  },
  parentVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderType',
    comment: 'Reference to previous version of this order type'
  },
  isLatestVersion: {
    type: Boolean,
    default: true,
    index: true,
    comment: 'If true, this is the latest version that should be used for new orders'
  },

  // Audit fields
  createdBy: {
    type: String,
    comment: 'User ID who created this order type'
  },
  updatedBy: {
    type: String,
    comment: 'User ID who last updated this order type'
  }
}, {
  timestamps: true,
  collection: 'orderTypes'
});

// ============================================================================
// INDEXES
// ============================================================================

// Compound index for branch-specific order types
OrderTypeSchema.index({ branchId: 1, typeCode: 1 }, { unique: true, sparse: true });

// Index for global order types
OrderTypeSchema.index({ isGlobal: 1, isActive: 1 });

// Index for default order type lookup
OrderTypeSchema.index({ isDefault: 1, isActive: 1 });

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Find order type by code
 */
OrderTypeSchema.statics.findByCode = function(typeCode, branchId = null) {
  const query = {
    typeCode: typeCode.toUpperCase(),
    isActive: true
  };

  if (branchId) {
    query.$or = [
      { branchId },
      { isGlobal: true }
    ];
  } else {
    query.isGlobal = true;
  }

  return this.findOne(query);
};

/**
 * Find active order types for a branch
 */
OrderTypeSchema.statics.findByBranch = function(branchId) {
  return this.find({
    $or: [
      { branchId },
      { isGlobal: true }
    ],
    isActive: true
  }).sort({ typeName: 1 });
};

/**
 * Find the default order type
 */
OrderTypeSchema.statics.findDefault = function(branchId = null) {
  const query = {
    isDefault: true,
    isActive: true
  };

  if (branchId) {
    query.$or = [
      { branchId },
      { isGlobal: true }
    ];
  } else {
    query.isGlobal = true;
  }

  return this.findOne(query);
};

/**
 * Find all active global order types
 */
OrderTypeSchema.statics.findGlobal = function() {
  return this.find({
    isGlobal: true,
    isActive: true
  }).sort({ typeName: 1 });
};

/**
 * Get next order number for this type
 */
OrderTypeSchema.methods.getNextOrderNumber = async function(branchCode = '') {
  // Increment sequence counter
  this.sequenceCounter += 1;
  await this.save();

  // Format sequence with padding
  const paddedSequence = String(this.sequenceCounter).padStart(this.sequencePadding, '0');

  // Get date parts
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const fullDate = `${year}${month}${day}`;

  // Replace all supported placeholders in numberFormat
  let orderNumber = this.numberFormat
    .replace('{PREFIX}', this.numberPrefix)
    .replace('PREFIX', this.numberPrefix)  // Support without braces
    .replace('{SEQUENCE}', paddedSequence)
    .replace('{SEQ}', paddedSequence)  // Short version
    .replace('{BRANCH}', branchCode)
    .replace('{DATE}', fullDate)
    .replace('{YYYY}', year)
    .replace('{MM}', month)
    .replace('{DD}', day);

  return orderNumber;
};

/**
 * Check if quantity is within validation rules
 */
OrderTypeSchema.methods.validateQuantity = function(quantity) {
  if (!this.validationRules) {
    return { valid: true };
  }

  const { minQuantity, maxQuantity } = this.validationRules;

  if (minQuantity && quantity < minQuantity) {
    return {
      valid: false,
      error: `Minimum quantity for '${this.typeName}' is ${minQuantity}`
    };
  }

  if (maxQuantity && quantity > maxQuantity) {
    return {
      valid: false,
      error: `Maximum quantity for '${this.typeName}' is ${maxQuantity}`
    };
  }

  return { valid: true };
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Ensure only one default order type exists
OrderTypeSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from all other order types in same scope
    const query = { _id: { $ne: this._id }, isDefault: true };

    if (this.branchId) {
      query.branchId = this.branchId;
    } else if (this.isGlobal) {
      query.isGlobal = true;
    }

    await this.constructor.updateMany(query, { isDefault: false });
  }

  next();
});

// ============================================================================
// VIRTUAL FIELDS
// ============================================================================

// Virtual populate for branch details
OrderTypeSchema.virtual('branch', {
  ref: 'Branch',
  localField: 'branchId',
  foreignField: '_id',
  justOne: true
});

// Enable virtuals in JSON output
OrderTypeSchema.set('toJSON', { virtuals: true });
OrderTypeSchema.set('toObject', { virtuals: true });

// ============================================================================
// EXPORTS
// ============================================================================

const OrderType = mongoose.models.OrderType || mongoose.model('OrderType', OrderTypeSchema);

module.exports = OrderType;
module.exports.createOrderTypeSchema = createOrderTypeSchema;
module.exports.updateOrderTypeSchema = updateOrderTypeSchema;
module.exports.orderTypeIdSchema = orderTypeIdSchema;
