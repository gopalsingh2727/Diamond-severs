const jwt = require('jsonwebtoken');
const connectToDatabase = require('../../config/mongodb/db');
const WebSocketConnection = require('../../models/websocket/connection');
const Admin = require('../../models/Admin/Admin');
const Manager = require('../../models/Manager/Manager');
const MasterAdmin = require('../../models/MasterAdmin/MasterAdmin');
const MachineOperator = require('../../models/MachineOperator/MachineOperator');

// Security Configuration
const MAX_CONNECTIONS_PER_USER = 10; // Maximum simultaneous connections per user
const MAX_CONNECTIONS_PER_IP = 50;   // Maximum connections per IP address

/**
 * WebSocket $connect Handler
 * Handles new WebSocket connection requests
 * Authenticates user and creates connection record
 *
 * SECURITY FEATURES:
 * - JWT authentication
 * - User existence and status validation
 * - Branch authorization (prevents cross-tenant access)
 * - Connection limits (per user and per IP)
 * - Secure error handling (no information leakage)
 */
module.exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const sourceIp = event.requestContext.identity?.sourceIp;

  // 🔒 SECURITY: Minimal logging - no sensitive data
  console.log('🔌 WebSocket connection attempt:', { connectionId, sourceIp });

  try {
    // Connect to database
    await connectToDatabase();

    // Get JWT token from query parameters
    const token = event.queryStringParameters?.token;

    if (!token) {
      console.error('❌ No token provided');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'yourSecr33232';
    let decodedToken;

    try {
      decodedToken = jwt.verify(token, jwtSecret);
    } catch (error) {
      console.error('❌ Invalid token');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // Extract user info from token
    const { userId, role } = decodedToken;

    // 🔒 SECURITY: Validate required fields
    if (!userId || !role) {
      console.error('❌ Missing user information in token');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // 🔒 SECURITY: Only log userId and role, not entire token
    console.log('✅ Token verified:', { userId, role });

    // Determine user model based on role
    let userModel;
    let UserModel;

    switch (role) {
      case 'admin':
        userModel = 'Admin';
        UserModel = Admin;
        break;
      case 'manager':
        userModel = 'Manager';
        UserModel = Manager;
        break;
      case 'masterAdmin':
        userModel = 'MasterAdmin';
        UserModel = MasterAdmin;
        break;
      case 'operator':
        userModel = 'MachineOperator';
        UserModel = MachineOperator;
        break;
      default:
        console.error('❌ Invalid role:', role);
        return {
          statusCode: 401,
          body: JSON.stringify({ message: 'Unauthorized' })
        };
    }

    // 🔒 SECURITY: Verify user exists and is active
    const user = await UserModel.findById(userId);

    if (!user) {
      console.error('❌ User not found:', userId);
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // 🔒 SECURITY: Check user status (if applicable)
    // Some models have isActive, isEmailVerified, etc.
    if (user.isActive === false) {
      console.error('❌ User is not active:', userId);
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Account is disabled' })
      };
    }

    // 🔒 SECURITY: Determine branchId from database, NOT from token
    // This prevents users from claiming to be in other branches
    let userBranchId;

    if (role === 'masterAdmin') {
      // Master admins can access all branches, use selectedBranch if available
      userBranchId = user.selectedBranch || decodedToken.branchId || null;
    } else {
      // Regular users: ALWAYS use branchId from database
      userBranchId = user.branchId;

      if (!userBranchId) {
        console.error('❌ User has no branch assigned:', userId);
        return {
          statusCode: 403,
          body: JSON.stringify({ message: 'No branch assigned' })
        };
      }
    }

    // 🔒 SECURITY: Check connection limits per user
    const userConnectionCount = await WebSocketConnection.countDocuments({
      userId,
      status: 'active'
    });

    if (userConnectionCount >= MAX_CONNECTIONS_PER_USER) {
      console.error('❌ User connection limit exceeded:', { userId, count: userConnectionCount });
      return {
        statusCode: 429,
        body: JSON.stringify({
          message: 'Connection limit exceeded',
          maxConnections: MAX_CONNECTIONS_PER_USER
        })
      };
    }

    // 🔒 SECURITY: Check connection limits per IP (prevent single IP attacks)
    if (sourceIp) {
      const ipConnectionCount = await WebSocketConnection.countDocuments({
        'metadata.ipAddress': sourceIp,
        status: 'active'
      });

      if (ipConnectionCount >= MAX_CONNECTIONS_PER_IP) {
        console.error('❌ IP connection limit exceeded:', { sourceIp, count: ipConnectionCount });
        return {
          statusCode: 429,
          body: JSON.stringify({
            message: 'Too many connections from this IP'
          })
        };
      }
    }

    // Get platform from query parameters
    const platform = event.queryStringParameters?.platform || 'web';
    const deviceId = event.queryStringParameters?.deviceId || null;

    // Validate platform
    const validPlatforms = ['electron', 'web', 'mobile'];
    if (!validPlatforms.includes(platform)) {
      console.warn('⚠️ Invalid platform:', platform);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid platform parameter' })
      };
    }

    // Extract user agent
    const userAgent = event.requestContext.identity?.userAgent;

    // Check if connection already exists (reconnection)
    let connection = await WebSocketConnection.findOne({ connectionId });

    if (connection) {
      // Update existing connection
      connection.status = 'active';
      connection.lastActivity = new Date();
      connection.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await connection.save();

      console.log('✅ Connection reactivated:', { connectionId, userId });
    } else {
      // Create new connection record
      connection = new WebSocketConnection({
        connectionId,
        userId,
        userModel,
        branchId: userBranchId,
        role,
        platform,
        deviceId,
        status: 'active',
        metadata: {
          userAgent,
          ipAddress: sourceIp,
          apiVersion: '1.0'
        },
        connectedAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      });

      // Assign default rooms based on role and branch
      connection.assignDefaultRooms();

      await connection.save();

      console.log('✅ New WebSocket connection created:', {
        connectionId,
        userId,
        role,
        branchId: connection.branchId,
        roomCount: connection.rooms.length
      });
    }

    // Return success response (minimal information)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Connected',
        connectionId,
        rooms: connection.rooms
      })
    };

  } catch (error) {
    console.error('❌ Error in $connect handler:', error);

    // 🔒 SECURITY: Generic error message, no internal details
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error'
      })
    };
  }
};
