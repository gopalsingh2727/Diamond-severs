const mongoose = require('mongoose');


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

module.exports = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);