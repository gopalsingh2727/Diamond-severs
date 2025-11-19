const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for admin registration/creation
const createAdminSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim()
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
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
    .default('admin'),
  product27InfinityId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format')
});

// Zod schema for admin login
const loginAdminSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Password is required')
});

// Zod schema for updating admin profile
const updateAdminSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim()
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional()
});

// Zod schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'New password must be less than 100 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number')
});

// Zod schema for password reset request
const passwordResetRequestSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
});

// Zod schema for password reset
const passwordResetSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

// Zod schema for admin ID parameter
const adminIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid admin ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const AdminuserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    default: 'admin'
  },

  // Password reset fields
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  // Active session token for single-device login
  activeSessionToken: { type: String },

  createdAt: {
    type: Date,
    default: Date.now
  },

  // Reference to Product27Infinity
  product27InfinityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product27Infinity',
    required: true
  }
});

// Middleware: Hash the password before saving
AdminuserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method: Compare input password with stored hash
AdminuserSchema.methods.comparePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

// Method to generate password reset token
AdminuserSchema.methods.generatePasswordResetToken = function () {
  const crypto = require('crypto');
  this.passwordResetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
  return this.passwordResetToken;
};

// ============================================================================
// EXPORTS
// ============================================================================

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminuserSchema);

module.exports = Admin;
module.exports.createAdminSchema = createAdminSchema;
module.exports.loginAdminSchema = loginAdminSchema;
module.exports.updateAdminSchema = updateAdminSchema;
module.exports.changePasswordSchema = changePasswordSchema;
module.exports.passwordResetRequestSchema = passwordResetRequestSchema;
module.exports.passwordResetSchema = passwordResetSchema;
module.exports.adminIdSchema = adminIdSchema;