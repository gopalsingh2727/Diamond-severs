// order.js
const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for machine progress
const zodMachineProgressSchema = z.object({
  machineId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format')
    .optional(),
  operatorId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid operatorId format')
    .optional()
    .nullable(),
  operatorName: z.string()
    .optional()
    .nullable(),
  status: z.enum(['none', 'pending', 'in-progress', 'completed', 'paused', 'error'], {
    errorMap: () => ({ message: 'Invalid machine status' })
  }).optional().default('none'),
  startedAt: z.string()
    .datetime()
    .or(z.date())
    .optional()
    .nullable(),
  completedAt: z.string()
    .datetime()
    .or(z.date())
    .optional()
    .nullable(),
  note: z.string()
    .optional()
    .nullable(),
  reason: z.string()
    .optional()
    .nullable()
});

// Zod schema for step progress
const zodStepProgressSchema = z.object({
  stepId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid stepId format'),
  machines: z.array(zodMachineProgressSchema).optional().default([]),
  stepStartedAt: z.string()
    .datetime()
    .or(z.date())
    .optional()
    .nullable(),
  stepCompletedAt: z.string()
    .datetime()
    .or(z.date())
    .optional()
    .nullable(),
  stepNotes: z.string().optional()
});

// Zod schema for mix material
const zodMixMaterialSchema = z.object({
  materialId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format'),
  materialName: z.string()
    .min(1, 'Material name is required'),
  plannedPercentage: z.number()
    .min(0, 'Planned percentage cannot be negative')
    .max(100, 'Planned percentage cannot exceed 100')
    .optional()
    .default(0),
  plannedWeight: z.number()
    .positive('Planned weight must be positive'),
  actualWeight: z.number()
    .min(0, 'Actual weight cannot be negative')
    .optional()
    .default(0),
  actualPercentage: z.number()
    .min(0, 'Actual percentage cannot be negative')
    .max(100, 'Actual percentage cannot exceed 100')
    .optional()
    .default(0),
  batchNumber: z.string().optional(),
  loadedAt: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  loadedBy: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid loadedBy ID format')
    .optional(),
  variance: z.number()
    .optional()
    .default(0),
  variancePercentage: z.number()
    .optional()
    .default(0),
  lastUpdated: z.string()
    .datetime()
    .or(z.date())
    .optional()
});

// Zod schema for mixing tracking
const zodMixingTrackingSchema = z.object({
  startTime: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  endTime: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  actualMixingTime: z.number()
    .min(0, 'Mixing time cannot be negative')
    .optional(),
  temperature: z.number().optional(),
  mixingSpeed: z.enum(['slow', 'medium', 'fast'], {
    errorMap: () => ({ message: 'Invalid mixing speed' })
  }).optional(),
  operatorId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid operatorId format')
    .optional(),
  notes: z.string().optional()
}).optional();

// Zod schema for order notes
const zodOrderNoteSchema = z.object({
  message: z.string()
    .min(1, 'Note message is required'),
  createdBy: z.string()
    .min(1, 'Note creator is required'),
  createdAt: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  noteType: z.enum(['general', 'production', 'quality', 'delivery', 'customer'], {
    errorMap: () => ({ message: 'Invalid note type' })
  }).optional().default('general')
});

// Zod schema for attachments
const zodAttachmentSchema = z.object({
  filename: z.string()
    .min(1, 'Filename is required'),
  fileUrl: z.string()
    .min(1, 'File URL is required'),
  fileType: z.string().optional(),
  uploadedBy: z.string()
    .min(1, 'Uploader is required'),
  uploadedAt: z.string()
    .datetime()
    .or(z.date())
    .optional()
});

// Zod schema for creating a new order
const createOrderSchema = z.object({
  customerId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid customerId format'),
  // Made optional - order type may not have material section
  materialId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format')
    .optional(),
  materialWeight: z.number()
    .min(0, 'Material weight cannot be negative')
    .optional()
    .default(0),
  Printing: z.boolean()
    .optional()
    .default(false),
  colors: z.array(z.string()).optional().default([]),
  designNotes: z.string().optional(),
  specialInstructions: z.string().optional(),
  materialFormulaId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialFormulaId format')
    .optional(),
  // NEW: Order Type and Spec references
  orderTypeId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid orderTypeId format')
    .optional(),
  productSpecId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format')
    .optional(),
  materialSpecId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialSpecId format')
    .optional(),
  mixMaterial: z.array(zodMixMaterialSchema).optional().default([]),
  steps: z.array(zodStepProgressSchema).optional().default([]),
  mixingTracking: zodMixingTrackingSchema,
  currentStepIndex: z.number()
    .int('Current step index must be an integer')
    .min(0, 'Current step index cannot be negative')
    .optional()
    .default(0),
  overallStatus: z.enum(['Wait for Approval', 'pending', 'approved', 'in_progress', 'completed', 'dispatched', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid overall status' })
  }).optional().default('Wait for Approval'),
  priority: z.enum(['low', 'normal', 'high', 'urgent'], {
    errorMap: () => ({ message: 'Invalid priority' })
  }).optional().default('normal'),
  sameDayDispatch: z.boolean()
    .optional()
    .default(false),
  scheduledStartDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  scheduledEndDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  actualStartDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  actualEndDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  dispatchedDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  createdBy: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid createdBy format'),
  createdByRole: z.enum(['admin', 'manager'], {
    errorMap: () => ({ message: 'Invalid created by role' })
  }),
  assignedManager: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedManager format')
    .optional(),
  notes: z.array(zodOrderNoteSchema).optional().default([]),
  attachments: z.array(zodAttachmentSchema).optional().default([])
});

// Zod schema for updating an order
const updateOrderSchema = z.object({
  materialWeight: z.number()
    .positive('Material weight must be positive')
    .optional(),
  Printing: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
  designNotes: z.string().optional(),
  specialInstructions: z.string().optional(),
  materialFormulaId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialFormulaId format')
    .optional(),
  // NEW: Order Type and Spec references (can be updated)
  orderTypeId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid orderTypeId format')
    .optional(),
  productSpecId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid productSpecId format')
    .optional(),
  materialSpecId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialSpecId format')
    .optional(),
  mixMaterial: z.array(zodMixMaterialSchema).optional(),
  steps: z.array(zodStepProgressSchema).optional(),
  mixingTracking: zodMixingTrackingSchema,
  currentStepIndex: z.number()
    .int('Current step index must be an integer')
    .min(0, 'Current step index cannot be negative')
    .optional(),
  overallStatus: z.enum(['Wait for Approval', 'pending', 'approved', 'in_progress', 'completed', 'dispatched', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid overall status' })
  }).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent'], {
    errorMap: () => ({ message: 'Invalid priority' })
  }).optional(),
  sameDayDispatch: z.boolean().optional(),
  scheduledStartDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  scheduledEndDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  actualStartDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  actualEndDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  dispatchedDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  assignedManager: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedManager format')
    .optional()
});

// Zod schema for order ID parameter
const orderIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID format')
});

// ============================================================================
// MONGOOSE SCHEMA - Machine Progress Schema - simplified
// ============================================================================
const machineProgressSchema = new mongoose.Schema({
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine',
    required: false
  },
  operatorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false, 
    default: null 
  },
  operatorName: {
    type: String,
    default: null
  },
  status: { 
    type: String, 
    enum: ['none', 'pending', 'in-progress', 'completed', 'paused', 'error'], 
    default: 'none'  
  },
  startedAt: { 
    type: Date, 
    default: null 
  },
  completedAt: { 
    type: Date, 
    default: null 
  },
  note: { 
    type: String, 
    default: null 
  },
  reason: { 
    type: String, 
    default: null 
  }
});

// Step Progress Schema
const stepProgressSchema = new mongoose.Schema({
  stepId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Step', 
    required: true 
  },
  machines: [machineProgressSchema],
  stepStartedAt: Date,
  stepCompletedAt: Date,
  stepNotes: String
});

// Mix Material Schema - Enhanced with actual tracking
const mixMaterialSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  // Planned amounts (from formula)
  plannedPercentage: {
    type: Number,
    default: 0
  },
  plannedWeight: {
    type: Number,
    required: true
  },
  // Actual usage (entered by operator during production)
  actualWeight: {
    type: Number,
    default: 0
  },
  actualPercentage: {
    type: Number,
    default: 0
  },
  // Tracking
  batchNumber: String,
  loadedAt: Date,
  loadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineOperator'
  },
  // Variance
  variance: {
    type: Number,  // actualWeight - plannedWeight
    default: 0
  },
  variancePercentage: {
    type: Number,  // (variance / plannedWeight) * 100
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Main Order Schema
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    comment: 'Legacy order ID or custom order number from OrderType'
  },

  // NEW: Order Type Configuration
  orderTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderType',
    index: true,
    comment: 'Reference to OrderType for type-based configuration'
  },

  // Customer and basic info
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },

  // NEW: Specification References
  productSpecId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductSpec',
    index: true,
    comment: 'Reference to product specification with dimensions'
  },
  materialSpecId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialSpec',
    index: true,
    comment: 'Reference to material specification with dimensions'
  },

  // Material specifications (optional - based on order type sections)
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: false  // Made optional - order type may not have material section
  },
  materialWeight: {
    type: Number,
    required: false,  // Made optional - order type may not have material section
    default: 0
  },
  
  // Printing
  Printing: { 
    type: Boolean, 
    default: false 
  },
  
  // Color and design specifications
  colors: [String],
  designNotes: String,
  specialInstructions: String,

  // Material Formula (NEW)
  materialFormulaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialFormula'
  },

  // Materials and production steps
  mixMaterial: [mixMaterialSchema],
  steps: [stepProgressSchema],

  // Mixing Tracking (NEW)
  mixingTracking: {
    startTime: Date,
    endTime: Date,
    actualMixingTime: Number,  // minutes
    temperature: Number,
    mixingSpeed: {
      type: String,
      enum: ['slow', 'medium', 'fast']
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MachineOperator'
    },
    notes: String
  },
  
  // Order progression
  currentStepIndex: { 
    type: Number, 
    default: 0 
  },
  overallStatus: {
    type: String,
    enum: ['Wait for Approval', 'pending', 'approved', 'in_progress', 'completed', 'dispatched', 'cancelled'],
    default: 'Wait for Approval'
  },
  
  // Priority and scheduling
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Same-day dispatch flag (NEW)
  sameDayDispatch: {
    type: Boolean,
    default: false
  },

  scheduledStartDate: Date,
  scheduledEndDate: Date,
  actualStartDate: Date,
  actualEndDate: Date,
  dispatchedDate: Date,
  
  // Location and management
  branchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Branch', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'createdByRole', 
    required: true 
  },
  createdByRole: { 
    type: String, 
    enum: ['admin', 'manager'], 
    required: true 
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Notes and communication
  notes: [{
    message: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    noteType: {
      type: String,
      enum: ['general', 'production', 'quality', 'delivery', 'customer'],
      default: 'general'
    }
  }],
  
  // Files and attachments
  attachments: [{
    filename: String,
    fileUrl: String,
    fileType: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// Note: orderId, orderTypeId, productSpecId, materialSpecId already have index: true in field definition
orderSchema.index({ branchId: 1, createdAt: -1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ overallStatus: 1 });
orderSchema.index({ priority: 1, scheduledStartDate: 1 });
// Compound index for order type + branch
orderSchema.index({ orderTypeId: 1, branchId: 1 });

// Virtual for order completion percentage
orderSchema.virtual('completionPercentage').get(function() {
  if (!this.steps || this.steps.length === 0) return 0;
  
  const completedSteps = this.steps.filter(step => step.stepStatus === 'completed').length;
  return Math.round((completedSteps / this.steps.length) * 100);
});

// Virtual for total estimated duration
orderSchema.virtual('estimatedDuration').get(function() {
  if (this.scheduledStartDate && this.scheduledEndDate) {
    return Math.ceil((this.scheduledEndDate - this.scheduledStartDate) / (1000 * 60 * 60 * 24)); // days
  }
  return 0;
});

// Pre-save middleware for Order ID generation
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      // NEW: Use OrderType number generation if orderTypeId is present
      if (this.orderTypeId) {
        const OrderType = mongoose.model('OrderType');
        const orderType = await OrderType.findById(this.orderTypeId);

        if (!orderType) {
          return next(new Error("Order type not found"));
        }

        // Get branch for code replacement
        const branch = await mongoose.model('Branch').findById(this.branchId);
        const branchCode = branch?.code || '';

        // Use OrderType's getNextOrderNumber method
        this.orderId = await orderType.getNextOrderNumber(branchCode);
      } else {
        // LEGACY: Old order ID generation logic for backward compatibility
        const branch = await mongoose.model('Branch').findById(this.branchId);

        if (!branch || !branch.code) {
          return next(new Error("Branch not found or missing code"));
        }

        const branchCode = branch.code;
        const date = new Date();
        const yyyyMMdd = date.toISOString().split('T')[0].replace(/-/g, '').substring(2);

        const count = await mongoose.model('Order').countDocuments({
          branchId: this.branchId,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        });

        this.orderId = `ORD-${branchCode}-${yyyyMMdd}-${(count + 1).toString().padStart(3, '0')}`;
      }
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// Instance method to initialize step machines with proper status
orderSchema.methods.initializeStepMachines = function() {
  this.steps.forEach(step => {
    if (step.machines && step.machines.length > 0) {
      // Set first machine to 'pending', rest to 'none'
      step.machines.forEach((machine, index) => {
        if (index === 0) {
          machine.status = 'pending';  // First machine ready to work
        } else {
          machine.status = 'none';     // Other machines waiting
        }
      });
    }
  });
  return this;
};

// Instance method to move to next machine in step
orderSchema.methods.completeCurrentMachine = async function(stepIndex) {
  if (this.steps[stepIndex] && this.steps[stepIndex].machines.length > 0) {
    const machines = this.steps[stepIndex].machines;
    
    // Find current active machine and complete it
    for (let i = 0; i < machines.length; i++) {
      if (machines[i].status === 'in-progress') {
        machines[i].status = 'completed';
        machines[i].completedAt = new Date();
        
        // Set next machine to pending (if exists)
        if (i + 1 < machines.length && machines[i + 1].status === 'none') {
          machines[i + 1].status = 'pending';
          machines[i + 1].startedAt = null; // Reset start time for new machine
        }
        
        break;
      }
    }
  }
  
  return await this.save();
};

// Instance method to progress to next step
orderSchema.methods.progressToNextStep = async function() {
  if (this.currentStepIndex < this.steps.length - 1) {
    if (this.steps[this.currentStepIndex]) {
      this.steps[this.currentStepIndex].stepStatus = 'completed';
      this.steps[this.currentStepIndex].stepCompletedAt = new Date();
    }
    
    this.currentStepIndex += 1;
    
    if (this.steps[this.currentStepIndex]) {
      this.steps[this.currentStepIndex].stepStatus = 'in-progress';
      this.steps[this.currentStepIndex].stepStartedAt = new Date();
      // Initialize machines for this new step
      this.initializeStepMachines();
    }
    
    if (this.currentStepIndex === this.steps.length - 1) {
      this.overallStatus = 'in_progress';
    }
  } else {
    this.overallStatus = 'completed';
    this.actualEndDate = new Date();
  }
  
  return await this.save();
};

// Instance method to add note
orderSchema.methods.addNote = async function(message, createdBy, noteType = 'general') {
  this.notes.push({
    message,
    createdBy,
    noteType,
    createdAt: new Date()
  });
  
  return await this.save();
};

// Static method to get order dashboard data
orderSchema.statics.getDashboardData = async function(branchId, dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  const pipeline = [
    {
      $match: {
        branchId: new mongoose.Types.ObjectId(branchId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$overallStatus',
        count: { $sum: 1 }
      }
    }
  ];
  
  const statusSummary = await this.aggregate(pipeline);
  
  return {
    dateRange: `${dateRange} days`,
    statusBreakdown: statusSummary,
    totalOrders: statusSummary.reduce((sum, item) => sum + item.count, 0)
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
module.exports.createOrderSchema = createOrderSchema;
module.exports.updateOrderSchema = updateOrderSchema;
module.exports.orderIdSchema = orderIdSchema;
module.exports.zodMachineProgressSchema = zodMachineProgressSchema;
module.exports.zodStepProgressSchema = zodStepProgressSchema;
module.exports.zodMixMaterialSchema = zodMixMaterialSchema;
module.exports.zodMixingTrackingSchema = zodMixingTrackingSchema;
module.exports.zodOrderNoteSchema = zodOrderNoteSchema;
module.exports.zodAttachmentSchema = zodAttachmentSchema;