const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for manager registration/creation
const createManagerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.string()
    .optional()
    .default('Manager'),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for manager login
const loginManagerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
});

// Zod schema for updating manager profile
const updateManagerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim()
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  isActive: z.boolean().optional()
});

// Zod schema for password change
const changeManagerPasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must be less than 100 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number')
});

// Zod schema for email verification
const verifyEmailSchema = z.object({
  token: z.string()
    .min(1, 'Verification token is required')
});

// Zod schema for password reset request
const managerPasswordResetRequestSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
});

// Zod schema for password reset
const managerPasswordResetSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

// Zod schema for manager ID parameter
const managerIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const managerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: { type: String, required: true, select: false }, // Don't include password by default (matches MasterAdminBackend)
  role: { type: String, default: 'Manager' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  product27InfinityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product27Infinity', required: true },

  // Email verification fields (matching MasterAdminBackend)
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

  // Account security fields
  isActive: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date },

  // Password reset fields
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  // Active session token for single-device login
  activeSessionToken: { type: String },

  createdAt: { type: Date, default: Date.now },
});


managerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});


managerSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for account lock status
managerSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to increment login attempts
managerSchema.methods.incLoginAttempts = function () {
  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
managerSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// Method to generate email verification token
managerSchema.methods.generateEmailVerificationToken = function () {
  const crypto = require('crypto');
  this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return this.emailVerificationToken;
};

// Method to generate password reset token
managerSchema.methods.generatePasswordResetToken = function () {
  const crypto = require('crypto');
  this.passwordResetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
  return this.passwordResetToken;
};

// Don't return sensitive fields in JSON
managerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  return obj;
};

// Add index for branchId (email and username already indexed via unique: true)
managerSchema.index({ branchId: 1 });

// ============================================================================
// EXPORTS
// ============================================================================

const Manager = mongoose.model('Manager', managerSchema);

module.exports = Manager;
module.exports.createManagerSchema = createManagerSchema;
module.exports.loginManagerSchema = loginManagerSchema;
module.exports.updateManagerSchema = updateManagerSchema;
module.exports.changeManagerPasswordSchema = changeManagerPasswordSchema;
module.exports.verifyEmailSchema = verifyEmailSchema;
module.exports.managerPasswordResetRequestSchema = managerPasswordResetRequestSchema;
module.exports.managerPasswordResetSchema = managerPasswordResetSchema;
module.exports.managerIdSchema = managerIdSchema;