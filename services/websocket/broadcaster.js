const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const WebSocketConnection = require('../../models/websocket/connection');

/**
 * WebSocket Broadcaster Service
 * Handles broadcasting messages to WebSocket connections via AWS API Gateway
 */
class WebSocketBroadcaster {
  constructor() {
    this.apiGatewayClient = null;
    this.websocketEndpoint = null;
  }

  /**
   * Initialize the API Gateway Management API client
   * @param {string} endpoint - WebSocket API Gateway endpoint
   */
  initialize(endpoint) {
    if (!endpoint) {
      // Try to get from environment variable
      const stage = process.env.STAGE || 'dev';
      const region = process.env.AWS_REGION || 'ap-south-1';
      const apiId = process.env.WEBSOCKET_API_ID;

      if (apiId) {
        endpoint = `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
      }
    }

    if (!endpoint) {
      console.warn('⚠️ WebSocket endpoint not configured. Broadcasting will be disabled.');
      return;
    }

    this.websocketEndpoint = endpoint;
    this.apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: endpoint,
      region: process.env.AWS_REGION || 'ap-south-1'
    });

    console.log('✅ WebSocket broadcaster initialized:', endpoint);
  }

  /**
   * Get or create API Gateway client
   * @param {string} endpoint - Optional endpoint override
   * @returns {ApiGatewayManagementApiClient}
   */
  getClient(endpoint) {
    if (endpoint && endpoint !== this.websocketEndpoint) {
      return new ApiGatewayManagementApiClient({
        endpoint: endpoint,
        region: process.env.AWS_REGION || 'ap-south-1'
      });
    }

    if (!this.apiGatewayClient) {
      this.initialize();
    }

    return this.apiGatewayClient;
  }

  /**
   * Send message to a specific connection
   * @param {string} connectionId - WebSocket connection ID
   * @param {Object} message - Message object to send
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<boolean>} Success status
   */
  async sendToConnection(connectionId, message, endpoint = null) {
    try {
      const client = this.getClient(endpoint);

      if (!client) {
        console.error('❌ WebSocket client not initialized');
        return false;
      }

      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message)
      });

      await client.send(command);
      console.log(`✅ Message sent to connection ${connectionId}:`, message.type);
      return true;

    } catch (error) {
      // Handle gone connections (410 status)
      if (error.statusCode === 410 || error.name === 'GoneException') {
        console.log(`🗑️ Stale connection ${connectionId}, marking as disconnected`);
        await this.handleStaleConnection(connectionId);
        return false;
      }

      console.error(`❌ Error sending to connection ${connectionId}:`, error.message);
      return false;
    }
  }

  /**
   * Broadcast message to multiple connections
   * @param {Array<string>} connectionIds - Array of connection IDs
   * @param {Object} message - Message object to broadcast
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary {sent, failed}
   */
  async broadcastToConnections(connectionIds, message, endpoint = null) {
    const results = {
      sent: 0,
      failed: 0,
      stale: 0
    };

    // Send messages in parallel
    const promises = connectionIds.map(async (connectionId) => {
      const success = await this.sendToConnection(connectionId, message, endpoint);
      if (success) {
        results.sent++;
      } else {
        results.failed++;
      }
    });

    await Promise.all(promises);

    console.log(`📊 Broadcast complete: ${results.sent} sent, ${results.failed} failed`);
    return results;
  }

  /**
   * Broadcast message to all connections in a room
   * @param {string} roomName - Room name
   * @param {Object} message - Message object to broadcast
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async broadcastToRoom(roomName, message, endpoint = null) {
    try {
      // Get all active connections in the room
      const connections = await WebSocketConnection.getActiveConnectionsInRoom(roomName);

      if (connections.length === 0) {
        console.log(`ℹ️ No active connections in room: ${roomName}`);
        return { sent: 0, failed: 0 };
      }

      const connectionIds = connections.map(conn => conn.connectionId);
      console.log(`📢 Broadcasting to room "${roomName}" (${connectionIds.length} connections)`);

      return await this.broadcastToConnections(connectionIds, message, endpoint);

    } catch (error) {
      console.error(`❌ Error broadcasting to room ${roomName}:`, error.message);
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Broadcast message to multiple rooms
   * @param {Array<string>} roomNames - Array of room names
   * @param {Object} message - Message object to broadcast
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async broadcastToRooms(roomNames, message, endpoint = null) {
    const totalResults = {
      sent: 0,
      failed: 0,
      rooms: roomNames.length
    };

    // Broadcast to each room
    for (const roomName of roomNames) {
      const result = await this.broadcastToRoom(roomName, message, endpoint);
      totalResults.sent += result.sent || 0;
      totalResults.failed += result.failed || 0;
    }

    console.log(`📊 Multi-room broadcast complete: ${totalResults.sent} sent across ${totalResults.rooms} rooms`);
    return totalResults;
  }

  /**
   * Broadcast to all connections in a branch
   * @param {string} branchId - Branch ID
   * @param {Object} message - Message object to broadcast
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async broadcastToBranch(branchId, message, endpoint = null) {
    return await this.broadcastToRoom(`branch:${branchId}`, message, endpoint);
  }

  /**
   * Send message to a specific user (all their active connections)
   * @param {string} userId - User ID
   * @param {Object} message - Message object to send
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async sendToUser(userId, message, endpoint = null) {
    try {
      const connections = await WebSocketConnection.getActiveConnectionsForUser(userId);

      if (connections.length === 0) {
        console.log(`ℹ️ No active connections for user: ${userId}`);
        return { sent: 0, failed: 0 };
      }

      const connectionIds = connections.map(conn => conn.connectionId);
      console.log(`👤 Sending to user ${userId} (${connectionIds.length} connections)`);

      return await this.broadcastToConnections(connectionIds, message, endpoint);

    } catch (error) {
      console.error(`❌ Error sending to user ${userId}:`, error.message);
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Broadcast to users with specific role in a branch
   * @param {string} role - User role (admin, manager, operator)
   * @param {string} branchId - Branch ID
   * @param {Object} message - Message object to broadcast
   * @param {string} endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async broadcastToRole(role, branchId, message, endpoint = null) {
    return await this.broadcastToRoom(`role:${role}:${branchId}`, message, endpoint);
  }

  /**
   * Handle stale/gone connection by marking it as disconnected
   * @param {string} connectionId - Connection ID
   * @private
   */
  async handleStaleConnection(connectionId) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId });
      if (connection) {
        await connection.markDisconnected();
      }
    } catch (error) {
      console.error(`❌ Error handling stale connection ${connectionId}:`, error.message);
    }
  }

  /**
   * Broadcast event with metadata
   * Helper method to standardize event broadcasting
   *
   * @param {Object} options - Broadcast options
   * @param {string} options.type - Event type (e.g., 'order:status_changed')
   * @param {Object} options.data - Event data
   * @param {Array<string>} options.rooms - Target rooms
   * @param {string} options.branchId - Target branch ID
   * @param {string} options.userId - Target user ID
   * @param {string} options.endpoint - Optional endpoint override
   * @returns {Promise<Object>} Result summary
   */
  async broadcastEvent({ type, data, rooms, branchId, userId, endpoint = null }) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    // Determine broadcast method
    if (userId) {
      return await this.sendToUser(userId, message, endpoint);
    }

    if (rooms && rooms.length > 0) {
      return await this.broadcastToRooms(rooms, message, endpoint);
    }

    if (branchId) {
      return await this.broadcastToBranch(branchId, message, endpoint);
    }

    console.warn('⚠️ No target specified for broadcast');
    return { sent: 0, failed: 0 };
  }
}

// Export singleton instance
const broadcasterInstance = new WebSocketBroadcaster();

// Export both class and instance
module.exports = broadcasterInstance;
module.exports.WebSocketBroadcaster = WebSocketBroadcaster;

// Convenience functions for direct use
module.exports.broadcastToRoom = (roomName, message, endpoint) =>
  broadcasterInstance.broadcastToRoom(roomName, message, endpoint);

module.exports.broadcastToRooms = (roomNames, message, endpoint) =>
  broadcasterInstance.broadcastToRooms(roomNames, message, endpoint);

module.exports.broadcastToBranch = (branchId, message, endpoint) =>
  broadcasterInstance.broadcastToBranch(branchId, message, endpoint);

module.exports.sendToUser = (userId, message, endpoint) =>
  broadcasterInstance.sendToUser(userId, message, endpoint);

module.exports.broadcastEvent = (options) =>
  broadcasterInstance.broadcastEvent(options);
