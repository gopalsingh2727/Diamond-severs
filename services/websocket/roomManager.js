const WebSocketConnection = require('../../models/websocket/connection');

/**
 * WebSocket Room Manager
 * Manages room subscriptions and connection-to-room mappings
 */
class RoomManager {
  /**
   * Subscribe a connection to a room
   * @param {string} connectionId - WebSocket connection ID
   * @param {string} roomName - Room name to subscribe to
   * @returns {Promise<boolean>} Success status
   */
  async subscribeToRoom(connectionId, roomName) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId });

      if (!connection) {
        console.error(`❌ Connection not found: ${connectionId}`);
        return false;
      }

      await connection.subscribeToRoom(roomName);
      console.log(`✅ Connection ${connectionId} subscribed to room: ${roomName}`);
      return true;

    } catch (error) {
      console.error(`❌ Error subscribing to room ${roomName}:`, error.message);
      return false;
    }
  }

  /**
   * Unsubscribe a connection from a room
   * @param {string} connectionId - WebSocket connection ID
   * @param {string} roomName - Room name to unsubscribe from
   * @returns {Promise<boolean>} Success status
   */
  async unsubscribeFromRoom(connectionId, roomName) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId });

      if (!connection) {
        console.error(`❌ Connection not found: ${connectionId}`);
        return false;
      }

      await connection.unsubscribeFromRoom(roomName);
      console.log(`✅ Connection ${connectionId} unsubscribed from room: ${roomName}`);
      return true;

    } catch (error) {
      console.error(`❌ Error unsubscribing from room ${roomName}:`, error.message);
      return false;
    }
  }

  /**
   * Subscribe to multiple rooms at once
   * @param {string} connectionId - WebSocket connection ID
   * @param {Array<string>} roomNames - Array of room names
   * @returns {Promise<Object>} Result summary {success, failed}
   */
  async subscribeToRooms(connectionId, roomNames) {
    const results = {
      success: 0,
      failed: 0,
      rooms: []
    };

    for (const roomName of roomNames) {
      const success = await this.subscribeToRoom(connectionId, roomName);
      if (success) {
        results.success++;
        results.rooms.push(roomName);
      } else {
        results.failed++;
      }
    }

    console.log(`📊 Multi-room subscription: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Get all rooms a connection is subscribed to
   * @param {string} connectionId - WebSocket connection ID
   * @returns {Promise<Array<string>>} Array of room names
   */
  async getConnectionRooms(connectionId) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId }).select('rooms');

      if (!connection) {
        return [];
      }

      return connection.rooms || [];

    } catch (error) {
      console.error(`❌ Error getting connection rooms:`, error.message);
      return [];
    }
  }

  /**
   * Get all active connections in a room
   * @param {string} roomName - Room name
   * @returns {Promise<Array>} Array of connection objects
   */
  async getRoomConnections(roomName) {
    try {
      return await WebSocketConnection.getActiveConnectionsInRoom(roomName);
    } catch (error) {
      console.error(`❌ Error getting room connections:`, error.message);
      return [];
    }
  }

  /**
   * Get connection count in a room
   * @param {string} roomName - Room name
   * @returns {Promise<number>} Connection count
   */
  async getRoomConnectionCount(roomName) {
    try {
      const count = await WebSocketConnection.countDocuments({
        rooms: roomName,
        status: 'active'
      });

      return count;
    } catch (error) {
      console.error(`❌ Error counting room connections:`, error.message);
      return 0;
    }
  }

  /**
   * Subscribe connection to order-specific room
   * @param {string} connectionId - WebSocket connection ID
   * @param {string} orderId - Order ID
   * @returns {Promise<boolean>} Success status
   */
  async subscribeToOrder(connectionId, orderId) {
    return await this.subscribeToRoom(connectionId, `order:${orderId}`);
  }

  /**
   * Subscribe connection to machine-specific room
   * @param {string} connectionId - WebSocket connection ID
   * @param {string} machineId - Machine ID
   * @returns {Promise<boolean>} Success status
   */
  async subscribeToMachine(connectionId, machineId) {
    return await this.subscribeToRoom(connectionId, `machine:${machineId}`);
  }

  /**
   * Subscribe connection to customer-specific room
   * @param {string} connectionId - WebSocket connection ID
   * @param {string} customerId - Customer ID
   * @returns {Promise<boolean>} Success status
   */
  async subscribeToCustomer(connectionId, customerId) {
    return await this.subscribeToRoom(connectionId, `customer:${customerId}`);
  }

  /**
   * Unsubscribe from all order rooms
   * @param {string} connectionId - WebSocket connection ID
   * @returns {Promise<number>} Number of rooms unsubscribed from
   */
  async unsubscribeFromAllOrders(connectionId) {
    try {
      const connection = await WebSocketConnection.findOne({ connectionId });

      if (!connection) {
        return 0;
      }

      const orderRooms = connection.rooms.filter(room => room.startsWith('order:'));

      for (const room of orderRooms) {
        await connection.unsubscribeFromRoom(room);
      }

      console.log(`✅ Unsubscribed from ${orderRooms.length} order rooms`);
      return orderRooms.length;

    } catch (error) {
      console.error(`❌ Error unsubscribing from order rooms:`, error.message);
      return 0;
    }
  }

  /**
   * Get room statistics for a branch
   * @param {string} branchId - Branch ID
   * @returns {Promise<Object>} Room statistics
   */
  async getBranchRoomStats(branchId) {
    try {
      const connections = await WebSocketConnection.find({
        branchId,
        status: 'active'
      }).select('rooms role');

      const stats = {
        totalConnections: connections.length,
        byRole: {
          admin: 0,
          manager: 0,
          operator: 0,
          masterAdmin: 0
        },
        roomCounts: {}
      };

      // Count by role
      connections.forEach(conn => {
        stats.byRole[conn.role] = (stats.byRole[conn.role] || 0) + 1;

        // Count unique rooms
        conn.rooms.forEach(room => {
          stats.roomCounts[room] = (stats.roomCounts[room] || 0) + 1;
        });
      });

      return stats;

    } catch (error) {
      console.error(`❌ Error getting branch room stats:`, error.message);
      return null;
    }
  }

  /**
   * Cleanup rooms with no active connections
   * This is informational only - MongoDB doesn't need cleanup
   * @returns {Promise<Object>} Cleanup statistics
   */
  async getOrphanedRooms() {
    try {
      const allConnections = await WebSocketConnection.find({ status: 'active' }).select('rooms');

      const roomsInUse = new Set();
      allConnections.forEach(conn => {
        conn.rooms.forEach(room => roomsInUse.add(room));
      });

      return {
        totalRooms: roomsInUse.size,
        rooms: Array.from(roomsInUse)
      };

    } catch (error) {
      console.error(`❌ Error getting orphaned rooms:`, error.message);
      return { totalRooms: 0, rooms: [] };
    }
  }

  /**
   * Get all active rooms with connection counts
   * @returns {Promise<Object>} Room list with counts
   */
  async getAllActiveRooms() {
    try {
      const connections = await WebSocketConnection.find({ status: 'active' }).select('rooms');

      const roomCounts = {};

      connections.forEach(conn => {
        conn.rooms.forEach(room => {
          roomCounts[room] = (roomCounts[room] || 0) + 1;
        });
      });

      return roomCounts;

    } catch (error) {
      console.error(`❌ Error getting all active rooms:`, error.message);
      return {};
    }
  }

  /**
   * Validate room name format
   * @param {string} roomName - Room name to validate
   * @returns {boolean} Is valid
   */
  isValidRoomName(roomName) {
    if (!roomName || typeof roomName !== 'string') {
      return false;
    }

    // Valid room name patterns:
    // - branch:{branchId}
    // - user:{userId}
    // - role:{role}:{branchId}
    // - order:{orderId}
    // - machine:{machineId}
    // - customer:{customerId}

    const validPatterns = [
      /^branch:[a-f0-9]{24}$/,
      /^user:[a-f0-9]{24}$/,
      /^role:(admin|manager|operator|masterAdmin):[a-f0-9]{24}$/,
      /^order:[a-f0-9]{24}$/,
      /^machine:[a-f0-9]{24}$/,
      /^customer:[a-f0-9]{24}$/
    ];

    return validPatterns.some(pattern => pattern.test(roomName));
  }

  /**
   * Parse room name to get room type and ID
   * @param {string} roomName - Room name
   * @returns {Object} Parsed room info {type, id, role}
   */
  parseRoomName(roomName) {
    const parts = roomName.split(':');

    if (parts.length < 2) {
      return null;
    }

    const result = {
      type: parts[0],
      id: parts[1],
      role: null
    };

    if (parts[0] === 'role' && parts.length === 3) {
      result.role = parts[1];
      result.id = parts[2];
    }

    return result;
  }
}

// Export singleton instance
const roomManagerInstance = new RoomManager();

module.exports = roomManagerInstance;
module.exports.RoomManager = RoomManager;
