const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a reminder
const createReminderSchema = z.object({
  userId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
  userRole: z.enum(['manager', 'admin', 'master-admin'], {
    errorMap: () => ({ message: 'Invalid user role' })
  }),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
    .optional(),
  product27InfinityId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format')
    .optional(),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  dueDate: z.string()
    .datetime()
    .or(z.date()),
  priority: z.enum(['low', 'normal', 'high'], {
    errorMap: () => ({ message: 'Invalid priority level' })
  }).optional().default('normal'),
  relatedOrderId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid orderId format')
    .optional(),
  relatedMachineId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format')
    .optional()
});

// Zod schema for updating a reminder
const updateReminderSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  dueDate: z.string()
    .datetime()
    .or(z.date())
    .optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  status: z.enum(['pending', 'completed', 'dismissed', 'snoozed']).optional()
});

// Zod schema for reminder ID parameter
const reminderIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid reminder ID format')
});

// Zod schema for listing reminders
const listRemindersSchema = z.object({
  userId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
  status: z.enum(['pending', 'completed', 'dismissed', 'snoozed', 'all']).optional().default('pending'),
  limit: z.number().min(1).max(100).optional().default(50),
  page: z.number().min(1).optional().default(1)
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const reminderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['manager', 'admin', 'master-admin']
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  product27InfinityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product27Infinity',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'dismissed', 'snoozed'],
    default: 'pending',
    index: true
  },
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedMachineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine'
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  },
  snoozedUntil: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
reminderSchema.index({ userId: 1, status: 1, dueDate: 1 });
reminderSchema.index({ userId: 1, dueDate: 1 });
reminderSchema.index({ branchId: 1, status: 1 });
reminderSchema.index({ dueDate: 1, notificationSent: 1 }); // For finding due reminders

// Method to mark as completed
reminderSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to snooze reminder
reminderSchema.methods.snooze = function(minutes = 30) {
  this.status = 'snoozed';
  this.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
  this.notificationSent = false; // Reset notification for snooze
  return this.save();
};

// Method to dismiss reminder
reminderSchema.methods.dismiss = function() {
  this.status = 'dismissed';
  return this.save();
};

// Static method to get due reminders
reminderSchema.statics.getDueReminders = async function() {
  const now = new Date();

  return this.find({
    status: { $in: ['pending', 'snoozed'] },
    notificationSent: false,
    $or: [
      { dueDate: { $lte: now }, status: 'pending' },
      { snoozedUntil: { $lte: now }, status: 'snoozed' }
    ]
  }).populate('relatedOrderId', 'orderId overallStatus')
    .populate('relatedMachineId', 'machineName status');
};

// Static method to get user's pending reminders
reminderSchema.statics.getUserPendingReminders = async function(userId, branchId, product27InfinityId) {
  const query = {
    userId,
    status: 'pending'
  };

  // Role-based filtering
  if (branchId) {
    query.branchId = branchId;
  }
  if (product27InfinityId) {
    query.product27InfinityId = product27InfinityId;
  }

  return this.find(query)
    .sort({ dueDate: 1 })
    .populate('relatedOrderId', 'orderId overallStatus')
    .populate('relatedMachineId', 'machineName status');
};

// Don't return sensitive internal fields in JSON
reminderSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// ============================================================================
// EXPORTS
// ============================================================================

const Reminder = mongoose.model('Reminder', reminderSchema);

module.exports = Reminder;
module.exports.createReminderSchema = createReminderSchema;
module.exports.updateReminderSchema = updateReminderSchema;
module.exports.reminderIdSchema = reminderIdSchema;
module.exports.listRemindersSchema = listRemindersSchema;
