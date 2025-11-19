const { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const WebSocketConnection = require('../../models/websocket/connection');

/**
 * WebSocket Session Manager
 * Handles single session enforcement - only ONE active session per user
 *
 * When a user logs in on a new device, all previous sessions are terminated
 */
class SessionManager {
  /**
   * Enforce single session - terminate all existing sessions for a user
   * @param {string} userId - User ID
   * @param {string} userModel - User model type (Admin, Manager, etc.)
   * @param {string} excludeConnectionId - Optional connection ID to keep (current session)
   * @returns {Promise<Object>} Result summary
   */
  async enforceSingleSession(userId, userModel, excludeConnectionId = null) {
    try {
      console.log('🔒 Enforcing single session for user:', { userId, userModel });

      // Find all active connections for this user
      const existingConnections = await WebSocketConnection.find({
        userId,
        userModel,
        status: 'active'
      });

      if (existingConnections.length === 0) {
        console.log('ℹ️ No existing sessions found');
        return {
          terminated: 0,
          kept: 0
        };
      }

      console.log(`📊 Found ${existingConnections.length} existing session(s)`);

      const results = {
        terminated: 0,
        kept: 0,
        errors: 0
      };

      // Get WebSocket API Gateway endpoint
      const endpoint = this.getWebSocketEndpoint();

      if (!endpoint) {
        console.warn('⚠️ WebSocket endpoint not configured - cannot send force logout messages');
      }

      // Process each connection
      for (const connection of existingConnections) {
        // Skip the current connection if specified
        if (excludeConnectionId && connection.connectionId === excludeConnectionId) {
          results.kept++;
          console.log(`✅ Keeping current session: ${connection.connectionId}`);
          continue;
        }

        try {
          // Send force logout message to the connection
          if (endpoint) {
            await this.sendForceLogout(connection.connectionId, endpoint, {
              reason: 'new_login',
              message: 'You have been logged out because a new session was started on another device',
              timestamp: new Date().toISOString()
            });
          }

          // Mark connection as disconnected in database
          await connection.markDisconnected();

          results.terminated++;
          console.log(`✅ Terminated session: ${connection.connectionId} (platform: ${connection.platform})`);

        } catch (error) {
          console.error(`❌ Error terminating session ${connection.connectionId}:`, error.message);
          results.errors++;
        }
      }

      console.log('📊 Single session enforcement complete:', results);
      return results;

    } catch (error) {
      console.error('❌ Error in enforceSingleSession:', error);
      throw error;
    }
  }

  /**
   * Send force logout message to a WebSocket connection
   * @param {string} connectionId - Connection ID
   * @param {string} endpoint - WebSocket API Gateway endpoint
   * @param {Object} data - Logout details
   * @private
   */
  async sendForceLogout(connectionId, endpoint, data) {
    try {
      const apiGatewayClient = new ApiGatewayManagementApiClient({
        endpoint: endpoint,
        region: process.env.AWS_REGION || 'ap-south-1'
      });

      const message = {
        type: 'session:force_logout',
        data: {
          reason: data.reason,
          message: data.message,
          timestamp: data.timestamp
        }
      };

      await apiGatewayClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message)
      }));

      console.log(`✅ Force logout message sent to ${connectionId}`);

      // Wait a moment for client to receive message
      await new Promise(resolve => setTimeout(resolve, 500));

      // Optionally force-disconnect the connection
      // Note: API Gateway will automatically disconnect stale connections
      // but we can explicitly close it here if needed

    } catch (error) {
      // If connection is already gone (410), that's fine
      if (error.statusCode === 410 || error.name === 'GoneException') {
        console.log(`ℹ️ Connection ${connectionId} already closed`);
      } else {
        console.error(`❌ Error sending force logout to ${connectionId}:`, error.message);
      }
    }
  }

  /**
   * Get WebSocket API Gateway endpoint
   * @returns {string|null} WebSocket endpoint URL
   * @private
   */
  getWebSocketEndpoint() {
    const stage = process.env.STAGE || 'dev';
    const region = process.env.AWS_REGION || 'ap-south-1';
    const apiId = process.env.WEBSOCKET_API_ID;

    if (!apiId) {
      return null;
    }

    return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of active sessions
   */
  async getActiveSessions(userId) {
    try {
      const sessions = await WebSocketConnection.find({
        userId,
        status: 'active'
      }).select('connectionId platform deviceId connectedAt lastActivity metadata');

      return sessions.map(session => ({
        connectionId: session.connectionId,
        platform: session.platform,
        deviceId: session.deviceId,
        connectedAt: session.connectedAt,
        lastActivity: session.lastActivity,
        ipAddress: session.metadata?.ipAddress,
        userAgent: session.metadata?.userAgent
      }));

    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Terminate a specific session
   * @param {string} connectionId - Connection ID to terminate
   * @returns {Promise<boolean>} Success status
   */
  async terminateSession(connectionId) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId });

      if (!connection) {
        console.warn(`⚠️ Connection not found: ${connectionId}`);
        return false;
      }

      // Send force logout message
      const endpoint = this.getWebSocketEndpoint();
      if (endpoint) {
        await this.sendForceLogout(connectionId, endpoint, {
          reason: 'admin_logout',
          message: 'Your session was terminated by an administrator',
          timestamp: new Date().toISOString()
        });
      }

      // Mark as disconnected
      await connection.markDisconnected();

      console.log(`✅ Session terminated: ${connectionId}`);
      return true;

    } catch (error) {
      console.error('❌ Error terminating session:', error);
      return false;
    }
  }

  /**
   * Terminate all sessions for a user (for account deactivation, password reset, etc.)
   * @param {string} userId - User ID
   * @param {string} reason - Reason for termination
   * @returns {Promise<number>} Number of sessions terminated
   */
  async terminateAllSessions(userId, reason = 'account_action') {
    try {
      console.log('🔒 Terminating all sessions for user:', { userId, reason });

      const result = await this.enforceSingleSession(userId, null, null);

      console.log(`✅ Terminated ${result.terminated} session(s) for user ${userId}`);
      return result.terminated;

    } catch (error) {
      console.error('❌ Error terminating all sessions:', error);
      return 0;
    }
  }

  /**
   * Check if user has multiple active sessions
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user has multiple sessions
   */
  async hasMultipleSessions(userId) {
    try {
      const count = await WebSocketConnection.countDocuments({
        userId,
        status: 'active'
      });

      return count > 1;

    } catch (error) {
      console.error('❌ Error checking multiple sessions:', error);
      return false;
    }
  }
}

// Export singleton instance
const sessionManagerInstance = new SessionManager();

module.exports = sessionManagerInstance;
module.exports.SessionManager = SessionManager;

// Convenience functions
module.exports.enforceSingleSession = (userId, userModel, excludeConnectionId) =>
  sessionManagerInstance.enforceSingleSession(userId, userModel, excludeConnectionId);

module.exports.getActiveSessions = (userId) =>
  sessionManagerInstance.getActiveSessions(userId);

module.exports.terminateSession = (connectionId) =>
  sessionManagerInstance.terminateSession(connectionId);

module.exports.terminateAllSessions = (userId, reason) =>
  sessionManagerInstance.terminateAllSessions(userId, reason);

module.exports.hasMultipleSessions = (userId) =>
  sessionManagerInstance.hasMultipleSessions(userId);
