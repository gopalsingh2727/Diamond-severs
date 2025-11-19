const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const connectToDatabase = require('../../config/mongodb/db');
const WebSocketConnection = require('../../models/websocket/connection');
const roomManager = require('../../services/websocket/roomManager');
const Order = require('../../models/oders/oders');
const Machine = require('../../models/Machine/machine');

// Security Configuration
const MAX_MESSAGE_SIZE = 128 * 1024; // 128 KB (API Gateway limit)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 100;  // Max messages per window

// In-memory rate limiting (consider Redis for multi-Lambda scalability)
const rateLimitStore = new Map();

/**
 * WebSocket $default Handler
 * Handles all incoming WebSocket messages from clients
 * Routes messages to appropriate handlers
 *
 * SECURITY FEATURES:
 * - Message size validation
 * - Rate limiting (100 messages/minute)
 * - Authorization checks for room subscriptions
 * - Branch isolation (users can only access their branch data)
 * - Secure error handling (no information leakage)
 */
module.exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  try {
    // 🔒 SECURITY: Validate message size BEFORE parsing
    const messageSize = event.body ? event.body.length : 0;

    if (messageSize > MAX_MESSAGE_SIZE) {
      console.error('❌ Message too large:', { connectionId, size: messageSize });
      return {
        statusCode: 413,
        body: JSON.stringify({ message: 'Message too large' })
      };
    }

    // Connect to database
    await connectToDatabase();

    // Get connection ID and domain from event
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;

    // Create API Gateway Management API client for sending responses
    const apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: `https://${domain}/${stage}`,
      region: process.env.AWS_REGION || 'ap-south-1'
    });

    /**
     * Helper function to send response back to client
     */
    const sendResponse = async (data) => {
      try {
        await apiGatewayClient.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify(data)
        }));
      } catch (error) {
        console.error('❌ Error sending response:', error.message);
      }
    };

    // Parse incoming message
    let message;
    try {
      message = JSON.parse(event.body);
    } catch (error) {
      console.error('❌ Invalid JSON');
      await sendResponse({
        error: 'Invalid JSON',
        message: 'Message body must be valid JSON'
      });
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const { action } = message;

    // 🔒 SECURITY: Minimal logging - only action and connectionId
    console.log('📨 WebSocket message:', { connectionId, action });

    // Find connection record
    const connection = await WebSocketConnection.findOne({ connectionId });

    if (!connection) {
      console.error('❌ Connection not found:', connectionId);
      await sendResponse({
        error: 'Connection not found',
        message: 'Please reconnect'
      });
      return { statusCode: 404, body: 'Connection not found' };
    }

    // 🔒 SECURITY: Rate limiting check
    const now = Date.now();
    const rateLimitKey = `${connection.userId}`;
    const userRateLimit = rateLimitStore.get(rateLimitKey) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

    // Reset if window expired
    if (now > userRateLimit.resetAt) {
      userRateLimit.count = 0;
      userRateLimit.resetAt = now + RATE_LIMIT_WINDOW;
    }

    // Increment and check limit
    userRateLimit.count++;
    rateLimitStore.set(rateLimitKey, userRateLimit);

    if (userRateLimit.count > RATE_LIMIT_MAX_MESSAGES) {
      console.error('❌ Rate limit exceeded:', { userId: connection.userId, count: userRateLimit.count });
      await sendResponse({
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMIT_MAX_MESSAGES} messages per minute`,
        retryAfter: Math.ceil((userRateLimit.resetAt - now) / 1000)
      });
      return { statusCode: 429, body: 'Rate limit exceeded' };
    }

    // Update last activity
    await connection.updateActivity();

    // Route based on action
    switch (action) {
      case 'ping':
        // Heartbeat / keep-alive
        await sendResponse({
          action: 'pong',
          timestamp: new Date().toISOString()
        });
        break;

      case 'subscribe':
        // Subscribe to specific room(s)
        const { data: subscribeData } = message;

        if (!subscribeData || !subscribeData.room) {
          await sendResponse({
            error: 'Missing room parameter',
            action: 'subscribe'
          });
          break;
        }

        const roomName = subscribeData.room;

        // 🔒 SECURITY: Validate room name format
        if (!roomManager.isValidRoomName(roomName)) {
          await sendResponse({
            error: 'Invalid room name format',
            action: 'subscribe'
          });
          break;
        }

        // 🔒 SECURITY: Authorization check - verify user can access this room
        const roomParsed = roomManager.parseRoomName(roomName);

        if (!roomParsed) {
          await sendResponse({
            error: 'Invalid room name',
            action: 'subscribe'
          });
          break;
        }

        let isAuthorized = false;

        switch (roomParsed.type) {
          case 'branch':
            // User can only subscribe to their own branch
            // Master admins can subscribe to any branch
            isAuthorized = (
              connection.role === 'masterAdmin' ||
              roomParsed.id === connection.branchId.toString()
            );
            break;

          case 'user':
            // User can only subscribe to their own user room
            isAuthorized = (roomParsed.id === connection.userId.toString());
            break;

          case 'role':
            // User can subscribe to their role in their branch
            isAuthorized = (
              (connection.role === 'masterAdmin' || roomParsed.id === connection.branchId.toString()) &&
              roomParsed.role === connection.role
            );
            break;

          case 'order':
          case 'machine':
          case 'customer':
            // These require database lookups - handle in specific subscribe actions
            await sendResponse({
              error: 'Use specific subscribe action',
              message: `Use subscribeToOrder, subscribeToMachine, or subscribeToCustomer instead`,
              action: 'subscribe'
            });
            return { statusCode: 400, body: 'Use specific action' };

          default:
            isAuthorized = false;
        }

        if (!isAuthorized) {
          console.error('❌ Unauthorized room subscription:', {
            userId: connection.userId,
            branchId: connection.branchId,
            roomName
          });
          await sendResponse({
            error: 'Unauthorized',
            message: 'You do not have permission to subscribe to this room',
            action: 'subscribe'
          });
          break;
        }

        const subscribeSuccess = await roomManager.subscribeToRoom(connectionId, roomName);

        await sendResponse({
          action: 'subscribe',
          success: subscribeSuccess,
          room: roomName,
          message: subscribeSuccess ? 'Subscribed successfully' : 'Subscription failed'
        });
        break;

      case 'unsubscribe':
        // Unsubscribe from specific room(s)
        const { data: unsubscribeData } = message;

        if (!unsubscribeData || !unsubscribeData.room) {
          await sendResponse({
            error: 'Missing room parameter',
            action: 'unsubscribe'
          });
          break;
        }

        const unsubscribeSuccess = await roomManager.unsubscribeFromRoom(connectionId, unsubscribeData.room);

        await sendResponse({
          action: 'unsubscribe',
          success: unsubscribeSuccess,
          room: unsubscribeData.room,
          message: unsubscribeSuccess ? 'Unsubscribed successfully' : 'Unsubscribe failed'
        });
        break;

      case 'getRooms':
        // Get list of subscribed rooms
        const rooms = await roomManager.getConnectionRooms(connectionId);

        await sendResponse({
          action: 'getRooms',
          rooms,
          count: rooms.length
        });
        break;

      case 'subscribeToOrder':
        // Subscribe to order-specific updates
        const { data: orderData } = message;

        if (!orderData || !orderData.orderId) {
          await sendResponse({
            error: 'Missing orderId parameter',
            action: 'subscribeToOrder'
          });
          break;
        }

        // 🔒 SECURITY: Verify order exists and belongs to user's branch
        try {
          const order = await Order.findById(orderData.orderId).select('branchId').lean();

          if (!order) {
            await sendResponse({
              error: 'Order not found',
              action: 'subscribeToOrder'
            });
            break;
          }

          // Check branch authorization
          const orderBranchId = order.branchId?.toString();
          const userBranchId = connection.branchId?.toString();

          if (connection.role !== 'masterAdmin' && orderBranchId !== userBranchId) {
            console.error('❌ Unauthorized order access:', {
              userId: connection.userId,
              userBranch: userBranchId,
              orderBranch: orderBranchId,
              orderId: orderData.orderId
            });
            await sendResponse({
              error: 'Unauthorized',
              message: 'You do not have permission to access this order',
              action: 'subscribeToOrder'
            });
            break;
          }

          // Authorized - subscribe to order room
          const orderSubscribeSuccess = await roomManager.subscribeToOrder(connectionId, orderData.orderId);

          await sendResponse({
            action: 'subscribeToOrder',
            success: orderSubscribeSuccess,
            orderId: orderData.orderId
          });

        } catch (error) {
          console.error('❌ Error in subscribeToOrder:', error);
          await sendResponse({
            error: 'Failed to subscribe to order',
            action: 'subscribeToOrder'
          });
        }
        break;

      case 'subscribeToMachine':
        // Subscribe to machine-specific updates
        const { data: machineData } = message;

        if (!machineData || !machineData.machineId) {
          await sendResponse({
            error: 'Missing machineId parameter',
            action: 'subscribeToMachine'
          });
          break;
        }

        // 🔒 SECURITY: Verify machine exists and belongs to user's branch
        try {
          const machine = await Machine.findById(machineData.machineId).select('branchId').lean();

          if (!machine) {
            await sendResponse({
              error: 'Machine not found',
              action: 'subscribeToMachine'
            });
            break;
          }

          // Check branch authorization
          const machineBranchId = machine.branchId?.toString();
          const userBranchId = connection.branchId?.toString();

          if (connection.role !== 'masterAdmin' && machineBranchId !== userBranchId) {
            console.error('❌ Unauthorized machine access:', {
              userId: connection.userId,
              userBranch: userBranchId,
              machineBranch: machineBranchId,
              machineId: machineData.machineId
            });
            await sendResponse({
              error: 'Unauthorized',
              message: 'You do not have permission to access this machine',
              action: 'subscribeToMachine'
            });
            break;
          }

          // Authorized - subscribe to machine room
          const machineSubscribeSuccess = await roomManager.subscribeToMachine(connectionId, machineData.machineId);

          await sendResponse({
            action: 'subscribeToMachine',
            success: machineSubscribeSuccess,
            machineId: machineData.machineId
          });

        } catch (error) {
          console.error('❌ Error in subscribeToMachine:', error);
          await sendResponse({
            error: 'Failed to subscribe to machine',
            action: 'subscribeToMachine'
          });
        }
        break;

      case 'getStatus':
        // Get connection status
        await sendResponse({
          action: 'getStatus',
          connectionId,
          role: connection.role,
          branchId: connection.branchId,
          rooms: connection.rooms,
          connectedAt: connection.connectedAt,
          platform: connection.platform,
          status: connection.status
        });
        break;

      default:
        // Unknown action
        console.warn('⚠️ Unknown action:', action);
        await sendResponse({
          error: 'Unknown action',
          message: `Action "${action}" is not supported`
        });
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed' })
    };

  } catch (error) {
    console.error('❌ Error in $default handler:', error);

    // 🔒 SECURITY: Generic error message, no internal details
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error'
      })
    };
  }
};
