const connectToDatabase = require('../../config/mongodb/db');
const WebSocketConnection = require('../../models/websocket/connection');

/**
 * WebSocket $disconnect Handler
 * Handles WebSocket disconnection events
 * Marks connection as disconnected and sets expiry
 */
module.exports.handler = async (event) => {
  console.log('🔌 WebSocket $disconnect event:', JSON.stringify(event, null, 2));

  try {
    // Connect to database
    await connectToDatabase();

    // Get connection ID from event
    const connectionId = event.requestContext.connectionId;

    if (!connectionId) {
      console.error('❌ No connection ID in disconnect event');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Bad Request: No connection ID' })
      };
    }

    // Find and update connection record
    const connection = await WebSocketConnection.findOne({ connectionId });

    if (!connection) {
      console.warn(`⚠️ Connection record not found for ${connectionId}`);
      // This is not an error - connection might have already been cleaned up
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Connection not found (already cleaned up)' })
      };
    }

    // Mark connection as disconnected
    await connection.markDisconnected();

    console.log('✅ Connection marked as disconnected:', {
      connectionId,
      userId: connection.userId,
      role: connection.role,
      duration: new Date() - connection.connectedAt
    });

    // Optionally broadcast user offline event
    // This can be useful for showing online/offline status in the UI
    const broadcaster = require('../../services/websocket/broadcaster');

    try {
      await broadcaster.broadcastEvent({
        type: 'user:disconnected',
        data: {
          userId: connection.userId,
          role: connection.role,
          disconnectedAt: new Date().toISOString()
        },
        branchId: connection.branchId
      });
    } catch (broadcastError) {
      console.warn('⚠️ Failed to broadcast disconnect event:', broadcastError.message);
      // Don't fail the disconnect if broadcast fails
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Disconnected successfully',
        connectionId
      })
    };

  } catch (error) {
    console.error('❌ Error in $disconnect handler:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
