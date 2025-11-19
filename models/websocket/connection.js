const mongoose = require('mongoose');

/**
 * WebSocket Connection Schema
 * Tracks active WebSocket connections for real-time updates
 *
 * Each connection represents a user's active WebSocket session
 * Connections are automatically cleaned up after 2 hours of inactivity
 */
const websocketConnectionSchema = new mongoose.Schema({
  // API Gateway WebSocket connection ID
  connectionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    refPath: 'userModel'
  },

  // Dynamic user model reference (Admin, Manager, MasterAdmin, or MachineOperator)
  userModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Manager', 'MasterAdmin', 'MachineOperator']
  },

  // Branch context
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },

  // User role
  role: {
    type: String,
    enum: ['masterAdmin', 'admin', 'manager', 'operator'],
    required: true,
    index: true
  },

  // Subscribed rooms (for targeted broadcasting)
  rooms: [{
    type: String,
    index: true
  }],

  // Client platform information
  platform: {
    type: String,
    enum: ['electron', 'web', 'mobile'],
    default: 'web'
  },

  // Device identifier (for multi-device tracking)
  deviceId: {
    type: String,
    default: null
  },

  // Connection status
  status: {
    type: String,
    enum: ['active', 'idle', 'disconnected'],
    default: 'active',
    index: true
  },

  // Last activity timestamp (for idle detection)
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Connection metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    apiVersion: String
  },

  // Connection timestamps
  connectedAt: {
    type: Date,
    default: Date.now
  },

  disconnectedAt: {
    type: Date,
    default: null
  },

  // TTL - Auto-delete after 2 hours of inactivity
  // This prevents stale connection records from accumulating
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    index: true
  }
}, {
  timestamps: true,
  collection: 'websocketConnections'
});

// Create TTL index for automatic cleanup
websocketConnectionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
websocketConnectionSchema.index({ branchId: 1, status: 1 });
websocketConnectionSchema.index({ userId: 1, status: 1 });
websocketConnectionSchema.index({ role: 1, branchId: 1, status: 1 });

/**
 * Auto-assign default rooms based on user role and branch
 * @returns {Array<string>} Array of room names
 */
websocketConnectionSchema.methods.assignDefaultRooms = function() {
  const rooms = [
    `branch:${this.branchId}`,           // Branch-wide updates
    `user:${this.userId}`,               // User-specific notifications
    `role:${this.role}:${this.branchId}` // Role-specific updates per branch
  ];

  this.rooms = rooms;
  return rooms;
};

/**
 * Subscribe to a specific room
 * @param {string} roomName - Room name to subscribe to
 * @returns {Promise<void>}
 */
websocketConnectionSchema.methods.subscribeToRoom = async function(roomName) {
  if (!this.rooms.includes(roomName)) {
    this.rooms.push(roomName);
    await this.save();
  }
};

/**
 * Unsubscribe from a room
 * @param {string} roomName - Room name to unsubscribe from
 * @returns {Promise<void>}
 */
websocketConnectionSchema.methods.unsubscribeFromRoom = async function(roomName) {
  const index = this.rooms.indexOf(roomName);
  if (index > -1) {
    this.rooms.splice(index, 1);
    await this.save();
  }
};

/**
 * Update last activity and reset TTL
 * @returns {Promise<void>}
 */
websocketConnectionSchema.methods.updateActivity = async function() {
  this.lastActivity = new Date();
  this.status = 'active';
  this.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Reset 2-hour TTL
  await this.save();
};

/**
 * Mark connection as disconnected
 * @returns {Promise<void>}
 */
websocketConnectionSchema.methods.markDisconnected = async function() {
  this.status = 'disconnected';
  this.disconnectedAt = new Date();
  this.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Delete after 5 minutes
  await this.save();
};

/**
 * Static method: Get all active connections in a room
 * @param {string} roomName - Room name
 * @returns {Promise<Array>} Array of active connections
 */
websocketConnectionSchema.statics.getActiveConnectionsInRoom = async function(roomName) {
  return this.find({
    rooms: roomName,
    status: 'active'
  }).select('connectionId userId branchId role');
};

/**
 * Static method: Get all active connections for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active connections
 */
websocketConnectionSchema.statics.getActiveConnectionsForUser = async function(userId) {
  return this.find({
    userId,
    status: 'active'
  }).select('connectionId platform deviceId connectedAt');
};

/**
 * Static method: Get all active connections in a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of active connections
 */
websocketConnectionSchema.statics.getActiveConnectionsInBranch = async function(branchId) {
  return this.find({
    branchId,
    status: 'active'
  }).select('connectionId userId role');
};

/**
 * Static method: Cleanup stale connections (idle > 30 minutes)
 * @returns {Promise<number>} Number of cleaned up connections
 */
websocketConnectionSchema.statics.cleanupStaleConnections = async function() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const result = await this.updateMany(
    {
      status: 'active',
      lastActivity: { $lt: thirtyMinutesAgo }
    },
    {
      $set: {
        status: 'idle',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Expire in 5 minutes
      }
    }
  );

  return result.modifiedCount;
};

const WebSocketConnection = mongoose.model('WebSocketConnection', websocketConnectionSchema);

module.exports = WebSocketConnection;
