const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for pricing
const pricingSchema = z.object({
  model: z.enum(['free', 'one_time', 'subscription', 'freemium', 'usage_based']).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'one_time', 'usage']).optional()
});

// Zod schema for features
const featureSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional()
});

// Zod schema for creating Product27Infinity
const createProduct27InfinitySchema = z.object({
  Product27InfinityId: z.string().min(1, 'Product27InfinityId is required'),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  type: z.enum(['software', 'service', 'saas', 'mobile_app', 'web_app', 'api', 'other']).optional(),
  category: z.enum(['productivity', 'business', 'education', 'entertainment', 'utility', 'other']).optional(),
  status: z.enum(['active', 'inactive', 'development', 'deprecated']).optional(),
  version: z.string().optional(),
  pricing: pricingSchema.optional(),
  features: z.array(featureSchema).optional(),
  isActive: z.boolean().optional()
});

// Zod schema for updating Product27Infinity
const updateProduct27InfinitySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['software', 'service', 'saas', 'mobile_app', 'web_app', 'api', 'other']).optional(),
  category: z.enum(['productivity', 'business', 'education', 'entertainment', 'utility', 'other']).optional(),
  status: z.enum(['active', 'inactive', 'development', 'deprecated']).optional(),
  version: z.string().optional(),
  pricing: pricingSchema.optional(),
  features: z.array(featureSchema).optional(),
  isActive: z.boolean().optional()
});

// Zod schema for Tracking
const createTrackingSchema = z.object({
  trackingId: z.string().min(1),
  Product27InfinityId: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional(),
  reason: z.enum(['user_request', 'admin_action', 'performance_issue', 'maintenance', 'other']).optional(),
  description: z.string().max(500).optional()
});

// Zod schema for updating Tracking
const updateTrackingSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  reason: z.enum(['user_request', 'admin_action', 'performance_issue', 'maintenance', 'other']).optional(),
  description: z.string().max(500).optional()
});

// ============================================================================
// MONGOOSE SCHEMAS
// ============================================================================

// ============= PRODUCT27INFINITY SCHEMA (Tracking System) =============
const Product27InfinitySchema = new mongoose.Schema({
  Product27InfinityId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['software', 'service', 'saas', 'mobile_app', 'web_app', 'api', 'other'],
    default: 'software'
  },
  category: {
    type: String,
    enum: ['productivity', 'business', 'education', 'entertainment', 'utility', 'other'],
    default: 'business'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'development', 'deprecated'],
    default: 'active'
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  pricing: {
    model: {
      type: String,
      enum: ['free', 'one_time', 'subscription', 'freemium', 'usage_based'],
      default: 'subscription'
    },
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'one_time', 'usage'],
      default: 'monthly'
    }
  },
  features: [{
    name: String,
    description: String,
    enabled: { type: Boolean, default: true }
  }],
  metrics: {
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
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
});

Product27InfinitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

Product27InfinitySchema.statics.findActive = function() {
  return this.find({ isActive: true, status: 'active' });
};

Product27InfinitySchema.methods.updateMetrics = function(metrics) {
  this.metrics = {
    ...this.metrics,
    ...metrics,
    lastUpdated: new Date()
  };
  return this.save();
};

Product27InfinitySchema.index({ Product27InfinityId: 1 });
Product27InfinitySchema.index({ status: 1 });
Product27InfinitySchema.index({ type: 1 });

// ============= TRACKING SCHEMA =============
const TrackingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    required: true,
    unique: true
  },
  Product27InfinityId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  reason: {
    type: String,
    enum: ['user_request', 'admin_action', 'performance_issue', 'maintenance', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    maxlength: 500
  },
  trackedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

TrackingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

TrackingSchema.statics.findByProductId = function(Product27InfinityId) {
  return this.find({ Product27InfinityId });
};

TrackingSchema.statics.findByUserId = function(userId) {
  return this.find({ userId });
};

TrackingSchema.statics.findActive = function(Product27InfinityId) {
  return this.find({ Product27InfinityId, status: 'active' });
};

TrackingSchema.index({ Product27InfinityId: 1 });
TrackingSchema.index({ userId: 1 });
TrackingSchema.index({ status: 1 });
TrackingSchema.index({ trackedAt: -1 });

// ============= EXPORTS =============
const Product27Infinity = mongoose.models.Product27Infinity || mongoose.model('Product27Infinity', Product27InfinitySchema);
const Tracking = mongoose.models.Tracking || mongoose.model('Tracking', TrackingSchema);

module.exports = {
  Product27Infinity,
  Tracking,
  // Zod schemas
  createProduct27InfinitySchema,
  updateProduct27InfinitySchema,
  createTrackingSchema,
  updateTrackingSchema,
  pricingSchema,
  featureSchema
};
