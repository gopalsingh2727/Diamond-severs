/**
 * MasterAdmin Model - Multi-Connection Support
 *
 * This is a refactored version that supports multiple database connections.
 * To use this version, rename it to masterAdmin.js (backup the original first)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const masterAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: 'master_admin',
      immutable: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [
        'view_all_branches',
        'manage_branches',
        'view_all_users',
        'manage_users',
        'view_all_orders',
        'manage_orders',
        'view_analytics',
        'manage_system_settings',
        'view_logs',
        'manage_admins',
        'manage_managers',
        'manage_operators',
        'manage_machines',
        'manage_products',
        'manage_materials',
        'view_financial_reports',
        'export_data',
        'backup_database',
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    sessionToken: {
      type: String,
    },
    sessionExpires: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterAdmin',
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterAdmin',
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================================
// INDEXES
// ============================================================================

masterAdminSchema.index({ email: 1 });
masterAdminSchema.index({ username: 1 });
masterAdminSchema.index({ isActive: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

// Virtual for account lock status
masterAdminSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Hash password before saving
masterAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

// Method to compare password
masterAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
masterAdminSchema.methods.incLoginAttempts = function () {
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
masterAdminSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// Method to check if user has permission
masterAdminSchema.methods.hasPermission = function (permission) {
  if (this.isSuperAdmin) return true;
  return this.permissions.includes(permission);
};

// Method to generate session token
masterAdminSchema.methods.generateSessionToken = function () {
  const crypto = require('crypto');
  this.sessionToken = crypto.randomBytes(32).toString('hex');
  this.sessionExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return this.sessionToken;
};

// Don't return password and sensitive fields
masterAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  delete obj.passwordResetToken;
  delete obj.sessionToken;
  return obj;
};

// ============================================================================
// STATIC METHODS
// ============================================================================

// Static method to find by credentials
masterAdminSchema.statics.findByCredentials = async function (username, password) {
  const admin = await this.findOne({
    $or: [{ email: username }, { username: username }],
  });

  if (!admin) {
    throw new Error('Invalid credentials');
  }

  if (admin.isLocked) {
    throw new Error('Account is locked. Please try again later.');
  }

  if (!admin.isActive) {
    throw new Error('Account is deactivated');
  }

  const isMatch = await admin.comparePassword(password);

  if (!isMatch) {
    await admin.incLoginAttempts();
    throw new Error('Invalid credentials');
  }

  // Reset login attempts on successful login
  if (admin.loginAttempts > 0) {
    await admin.resetLoginAttempts();
  }

  return admin;
};

// ============================================================================
// EXPORTS
// ============================================================================

// Export schema separately for multi-connection support
module.exports.schema = masterAdminSchema;

// Export compiled model for backward compatibility (uses default mongoose connection)
// This allows existing code to continue working
module.exports = mongoose.models.MasterAdmin || mongoose.model('MasterAdmin', masterAdminSchema);
