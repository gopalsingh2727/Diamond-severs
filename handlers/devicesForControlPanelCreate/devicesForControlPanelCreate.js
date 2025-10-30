const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const connect = require("../../config/mongodb/db");
const DeviceAccess = require("../../models/deviceAccess/deviceAccess");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

module.exports.loginDeviceForControllPanel = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    await connect();

    // API Key validation
    // const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    // if (!apiKey || apiKey !== process.env.API_KEY) {
    //   return {
    //     statusCode: 403,
    //     headers: corsHeaders,
    //     body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
    //   };
    // }

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid request body" }),
      };
    }

    const { deviceName, password, pin } = body;

    // Validation
    if (!deviceName || (!password && !pin)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device name and password/pin required" }),
      };
    }

    // Find device
    const device = await DeviceAccess.findOne({ deviceName });
    if (!device) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device not found" }),
      };
    }

    // Verify credentials
    let isMatch = false;
    if (password) {
      isMatch = await bcrypt.compare(password, device.password);
    } else if (pin) {
      isMatch = pin === device.pin;
    }

    if (!isMatch) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid credentials" }),
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: device._id,
        role: "device",
        deviceName: device.deviceName,
        branchId: device.branchId || null,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Login successful",
        token,
        device: {
          id: device._id,
          deviceName: device.deviceName,
          location: device.location,
        },
      }),
    };

  } catch (err) {
    console.error('Error in loginDeviceForControllPanel:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: err.message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }),
    };
  }
};




//   context.callbackWaitsForEmptyEventLoop = false;
  
//   const headers = event.headers || {};
//   const corsHeaders = {
//     "Access-Control-Allow-Origin": "*",
//     "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
//     "Access-Control-Allow-Methods": "GET, OPTIONS",
//     "Content-Type": "application/json",
//   };

//   // Handle preflight OPTIONS request
//   if (event.httpMethod === "OPTIONS") {
//     return {
//       statusCode: 200,
//       headers: corsHeaders,
//       body: "",
//     };
//   }

//   try {
//     await connect();

//     // API Key validation
//     // const apiKey = headers["x-api-key"] || headers["X-API-Key"];
//     // if (!apiKey || apiKey !== process.env.API_KEY) {
//     //   return {
//     //     statusCode: 403,
//     //     headers: corsHeaders,
//     //     body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
//     //   };
//     // }

//     // Token verification
//     const authHeader = headers.authorization || headers.Authorization;
//     let user;
//     try {
//       user = await verifyToken(authHeader);
//     } catch (tokenError) {
//       console.error('Token verification failed:', tokenError);
//       return {
//         statusCode: 401,
//         headers: corsHeaders,
//         body: JSON.stringify({ message: "Invalid or expired token" }),
//       };
//     }

//     if (!user) {
//       return {
//         statusCode: 401,
//         headers: corsHeaders,
//         body: JSON.stringify({ message: "Invalid token" }),
//       };
//     }

//     // Check if user is a device
//     // if (user.role !== 'device') {
//     //   return {
//     //     statusCode: 403,
//     //     headers: corsHeaders,
//     //     body: JSON.stringify({ message: "Only devices can access this endpoint" }),
//     //   };
//     // }

//     // Find the device by deviceName or ID
//     const device = await DeviceAccess.findOne({ 
//       deviceName: user.deviceName 
//     }).populate('machines.machineId', 'machineName machineType status location');

//     if (!device) {
//       return {
//         statusCode: 404,
//         headers: corsHeaders,
//         body: JSON.stringify({ message: "Device not found" }),
//       };
//     }

//     // Return the machines associated with this device
//     const machines = device.machines.map(machine => ({
//       id: machine.machineId?._id || machine.machineId,
//       machineId: machine.machineId?._id || machine.machineId,
//       machineName: machine.machineName,
//       machineType: machine.machineType,
//       addedAt: machine.addedAt,
//       // Include populated data if available
//       ...(machine.machineId && typeof machine.machineId === 'object' ? {
//         status: machine.machineId.status,
//         location: machine.machineId.location,
//         // Add any other machine fields you want to include
//       } : {})
//     }));

//     return {
//       statusCode: 200,
//       headers: corsHeaders,
//       body: JSON.stringify({
//         success: true,
//         device: {
//           deviceName: device.deviceName,
//           location: device.location,
//         },
//         machines: machines,
//         machineCount: machines.length
//       }),
//     };

//   } catch (err) {
//     console.error('Error in getDeviceMachines:', err);
//     return {
//       statusCode: 500,
//       headers: corsHeaders,
//       body: JSON.stringify({ 
//         message: err.message,
//         error: process.env.NODE_ENV === 'development' ? err.stack : undefined
//       }),
//     };
//   }
// };