const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating/updating chat settings
const chatSettingsSchema = z.object({
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
    .optional()
});

// Zod schema for updating settings
const updateChatSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  assistantName: z.string()
    .min(1, 'Assistant name is required')
    .max(50, 'Assistant name must be less than 50 characters')
    .trim()
    .optional(),
  voiceGender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'Invalid voice gender' })
  }).optional(),
  language: z.string()
    .max(10)
    .optional(),
  autoSpeak: z.boolean().optional(),
  speechRate: z.number()
    .min(0.5)
    .max(2)
    .optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    position: z.object({
      x: z.number().optional(),
      y: z.number().optional()
    }).optional()
  }).optional()
});

// Zod schema for user ID parameter
const userIdSchema = z.object({
  userId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const chatSettingsSchemaDB = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
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

  // Chat Agent Settings
  isEnabled: {
    type: Boolean,
    default: true
  },
  assistantName: {
    type: String,
    default: 'Assistant',
    trim: true,
    maxlength: 50
  },
  voiceGender: {
    type: String,
    enum: ['male', 'female'],
    default: 'female'
  },
  language: {
    type: String,
    default: 'en-IN'  // Indian English default
  },
  autoSpeak: {
    type: Boolean,
    default: true
  },
  speechRate: {
    type: Number,
    default: 1.0,
    min: 0.5,
    max: 2
  },

  // UI Settings
  theme: {
    primaryColor: {
      type: String,
      default: '#FF6B00'  // Orange
    },
    position: {
      x: { type: Number, default: null },  // null = default right
      y: { type: Number, default: null }   // null = default bottom
    }
  },

  // Hardware Info (for LLM capability check)
  hardwareInfo: {
    ramGB: { type: Number },
    canRunLocalLLM: { type: Boolean, default: false },
    lastChecked: { type: Date }
  },

  // Usage Statistics
  stats: {
    totalMessages: { type: Number, default: 0 },
    totalReminders: { type: Number, default: 0 },
    lastUsed: { type: Date }
  },

  // Rules acknowledged
  rulesAccepted: {
    type: Boolean,
    default: false
  },
  rulesAcceptedAt: {
    type: Date
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to get or create settings for user
chatSettingsSchemaDB.statics.getOrCreate = async function(userData) {
  let settings = await this.findOne({ userId: userData.userId });

  if (!settings) {
    settings = new this({
      userId: userData.userId,
      userRole: userData.userRole,
      branchId: userData.branchId,
      product27InfinityId: userData.product27InfinityId,
      assistantName: 'Assistant',
      voiceGender: 'female',
      isEnabled: true
    });
    await settings.save();
  }

  return settings;
};

// Method to update hardware info
chatSettingsSchemaDB.methods.updateHardwareInfo = function(ramGB) {
  this.hardwareInfo = {
    ramGB,
    canRunLocalLLM: ramGB >= 3, // TinyLlama needs 3GB+
    lastChecked: new Date()
  };
  return this.save();
};

// Method to increment message count
chatSettingsSchemaDB.methods.incrementMessageCount = function() {
  this.stats.totalMessages += 1;
  this.stats.lastUsed = new Date();
  return this.save();
};

// Method to increment reminder count
chatSettingsSchemaDB.methods.incrementReminderCount = function() {
  this.stats.totalReminders += 1;
  return this.save();
};

// Method to accept rules
chatSettingsSchemaDB.methods.acceptRules = function() {
  this.rulesAccepted = true;
  this.rulesAcceptedAt = new Date();
  return this.save();
};

// Method to update chat position (for draggable widget)
chatSettingsSchemaDB.methods.updatePosition = function(x, y) {
  this.theme.position = { x, y };
  return this.save();
};

// Don't return sensitive internal fields in JSON
chatSettingsSchemaDB.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// ============================================================================
// EXPORTS
// ============================================================================

const ChatSettings = mongoose.model('ChatSettings', chatSettingsSchemaDB);

module.exports = ChatSettings;
module.exports.chatSettingsSchema = chatSettingsSchema;
module.exports.updateChatSettingsSchema = updateChatSettingsSchema;
module.exports.userIdSchema = userIdSchema;
