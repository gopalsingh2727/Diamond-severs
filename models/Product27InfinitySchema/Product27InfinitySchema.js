const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
module.exports = {
  Product27Infinity: mongoose.models.Product27Infinity || mongoose.model('Product27Infinity', Product27InfinitySchema),
  Tracking: mongoose.models.Tracking || mongoose.model('Tracking', TrackingSchema)
};
