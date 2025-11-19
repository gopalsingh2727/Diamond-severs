const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for chat message
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Invalid message role' })
  }),
  content: z.string()
    .min(1, 'Message content is required')
    .max(10000, 'Message too long'),
  timestamp: z.date().optional()
});

// Zod schema for creating a conversation
const createConversationSchema = z.object({
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

// Zod schema for adding a message
const addMessageSchema = z.object({
  conversationId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid conversationId format')
    .optional(),
  message: messageSchema
});

// Zod schema for getting conversation history
const getHistorySchema = z.object({
  userId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
  limit: z.number()
    .min(1)
    .max(100)
    .optional()
    .default(50)
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const conversationSchema = new mongoose.Schema({
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
  messages: [{
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system']
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    assistantName: { type: String },
    voiceGender: { type: String, enum: ['male', 'female'] },
    totalMessages: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    index: true
  }
}, {
  timestamps: true
});

// TTL index - automatically delete documents after expiresAt
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ branchId: 1, createdAt: -1 });
conversationSchema.index({ product27InfinityId: 1, createdAt: -1 });

// Method to add a message to conversation
conversationSchema.methods.addMessage = function(role, content) {
  this.messages.push({
    role,
    content,
    timestamp: new Date()
  });
  this.metadata.totalMessages = this.messages.length;
  return this.save();
};

// Method to get recent messages
conversationSchema.methods.getRecentMessages = function(limit = 10) {
  return this.messages.slice(-limit);
};

// Static method to find or create conversation for user
conversationSchema.statics.findOrCreateForUser = async function(userData) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let conversation = await this.findOne({
    userId: userData.userId,
    createdAt: { $gte: today }
  });

  if (!conversation) {
    conversation = new this({
      userId: userData.userId,
      userRole: userData.userRole,
      branchId: userData.branchId,
      product27InfinityId: userData.product27InfinityId,
      messages: [],
      metadata: {
        assistantName: userData.assistantName,
        voiceGender: userData.voiceGender
      }
    });
    await conversation.save();
  }

  return conversation;
};

// Don't return sensitive internal fields in JSON
conversationSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// ============================================================================
// EXPORTS
// ============================================================================

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
module.exports.messageSchema = messageSchema;
module.exports.createConversationSchema = createConversationSchema;
module.exports.addMessageSchema = addMessageSchema;
module.exports.getHistorySchema = getHistorySchema;
