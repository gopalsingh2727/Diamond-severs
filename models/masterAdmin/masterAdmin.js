const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for master admin creation
const createMasterAdminSchema = z.object({
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
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be less than 100 characters')
    .trim(),
  phone: z.string()
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
    .optional(),
  isSuperAdmin: z.boolean()
    .optional()
    .default(false),
  permissions: z.array(z.string()).optional(),
  createdBy: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid createdBy ID format')
    .optional()
});

// Zod schema for master admin login
const loginMasterAdminSchema = z.object({
  username: z.string()
    .min(1, 'Username or email is required')
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
});

// Zod schema for updating master admin
const updateMasterAdminSchema = z.object({
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
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be less than 100 characters')
    .trim()
    .optional(),
  phone: z.string()
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
    .optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional()
});

// Zod schema for password change
const changeMasterAdminPasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must be less than 100 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'New password must contain at least one special character')
});

// Zod schema for password reset request
const masterAdminPasswordResetRequestSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
});

// Zod schema for password reset
const masterAdminPasswordResetSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
});

// Zod schema for permission check
const checkPermissionSchema = z.object({
  permission: z.string()
    .min(1, 'Permission name is required')
});

// Zod schema for master admin ID parameter
const masterAdminIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid master admin ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
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

// Indexes
masterAdminSchema.index({ email: 1 });
masterAdminSchema.index({ username: 1 });
masterAdminSchema.index({ isActive: 1 });

// Virtual for account lock status
masterAdminSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

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

const MasterAdmin = mongoose.model('MasterAdmin', masterAdminSchema);

module.exports = MasterAdmin;
module.exports.createMasterAdminSchema = createMasterAdminSchema;
module.exports.loginMasterAdminSchema = loginMasterAdminSchema;
module.exports.updateMasterAdminSchema = updateMasterAdminSchema;
module.exports.changeMasterAdminPasswordSchema = changeMasterAdminPasswordSchema;
module.exports.masterAdminPasswordResetRequestSchema = masterAdminPasswordResetRequestSchema;
module.exports.masterAdminPasswordResetSchema = masterAdminPasswordResetSchema;
module.exports.checkPermissionSchema = checkPermissionSchema;
module.exports.masterAdminIdSchema = masterAdminIdSchema;
