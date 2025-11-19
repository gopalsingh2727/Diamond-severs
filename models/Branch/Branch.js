const mongoose = require('mongoose');
const { z } = require('zod');


const createBranchSchema = z.object({
  name: z.string()
    .min(1, 'Branch name is required')
    .max(100, 'Branch name must be less than 100 characters')
    .trim(),
  location: z.string()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters')
    .trim(),
  code: z.string()
    .min(1, 'Branch code is required')
    .max(20, 'Branch code must be less than 20 characters')
    .toUpperCase()
    .trim(),
  product27InfinityId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format'),
  phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .default(''),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional()
    .default(''),
  userId: z.string()
    .min(1, 'userId is required'),
  isActive: z.boolean()
    .optional()
    .default(true)
});

// Zod schema for updating a branch
const updateBranchSchema = z.object({
  name: z.string()
    .min(1, 'Branch name is required')
    .max(100, 'Branch name must be less than 100 characters')
    .trim()
    .optional(),
  location: z.string()
    .min(1, 'Location is required')
    .max(200, 'Location must be less than 200 characters')
    .trim()
    .optional(),
  code: z.string()
    .min(1, 'Branch code is required')
    .max(20, 'Branch code must be less than 20 characters')
    .toUpperCase()
    .trim()
    .optional(),
  phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  isActive: z.boolean()
    .optional()
});

// Zod schema for branch ID parameter
const branchIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  product27InfinityId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'Product27Infinity',
     required: true
   },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  userId: {
    type: String,  // ✅ Added userId to track who created the branch
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update timestamp on save
BranchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ Compound indexes - ensures code is unique per product, not globally
BranchSchema.index({ code: 1, product27InfinityId: 1 }, { unique: true });

// ✅ Compound indexes - ensures name is unique per product, not globally
BranchSchema.index({ name: 1, product27InfinityId: 1 }, { unique: true });

// Static methods
BranchSchema.statics.findByCode = function(code, product27InfinityId) {
  return this.findOne({ 
    code: code.toUpperCase(),
    product27InfinityId,
    isActive: true 
  });
};

BranchSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

BranchSchema.statics.findByProductId = function(product27InfinityId) {
  return this.find({ product27InfinityId, isActive: true });
};

BranchSchema.statics.findByUserId = function(userId) {
  return this.find({ userId, isActive: true });
};

// ✅ Virtual populate - allows you to populate product details
BranchSchema.virtual('product', {
  ref: 'Product27Infinity',
  localField: 'product27InfinityId',
  foreignField: 'Product27InfinityId',
  justOne: true
});

// Enable virtuals in JSON output
BranchSchema.set('toJSON', { virtuals: true });
BranchSchema.set('toObject', { virtuals: true });

// ============================================================================
// EXPORTS
// ============================================================================

const Branch = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);

module.exports = Branch;
module.exports.createBranchSchema = createBranchSchema;
module.exports.updateBranchSchema = updateBranchSchema;
module.exports.branchIdSchema = branchIdSchema;