const connect = require("../../config/mongodb/db");
const DeviceAccess = require("../../models/deviceAccess/deviceAccess");
const verifyToken = require('../../utiles/verifyToken');
const Branch = require("../../models/branch/branch");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
  return apiKey === process.env.API_KEY;
};



// OPTIONS handler (for all)
const handleOptions = (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }
};




module.exports.createDeviceAccess = async (event, context) => {
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
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    const authHeader = headers.authorization || headers.Authorization;
    let user;
    
    try {
      user = await verifyToken(authHeader);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }

    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Only admin or manager can create device access" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    // ─────── VALIDATION ───────
    if (!body.deviceName || typeof body.deviceName !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device name is required and must be a string" }),
      };
    }

    if (!body.location || typeof body.location !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device location is required and must be a string" }),
      };
    }

    if (!body.password || typeof body.password !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Password is required and must be a string" }),
      };
    }

    // Determine branch ID
    const branchId = user.role === "admin" ? body.branchId : user.branchId;
    
    if (!branchId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Branch ID is required" }),
      };
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Branch not found" }),
      };
    }

    // Check for device name uniqueness
    const existingDevice = await DeviceAccess.findOne({ deviceName: body.deviceName.trim() });
    if (existingDevice) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device name must be unique" }),
      };
    }

    // Generate unique device ID
    let deviceId;
    try {
      deviceId = await DeviceAccess.generateDeviceId(branchId);
    } catch (error) {
      console.error('Device ID generation failed:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Failed to generate device ID: " + error.message }),
      };
    }

    // Create device access
    const deviceAccess = new DeviceAccess({
      deviceId: deviceId,
      deviceName: body.deviceName.trim(),
      location: body.location.trim(),
      password: body.password,
      branchId: branchId,
    });

    await deviceAccess.save();

    // Return response without password
    const responseData = deviceAccess.toObject();
    delete responseData.password;
    console.log( 'Device access created successfully:', responseData );
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(responseData),
    };
  } catch (err) {
    console.error('Error in createDeviceAccess:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message || "Internal server error" }),
    };
  }
};





// Update your getDeviceAccessList function in backend

module.exports.getDeviceAccessList = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    const authHeader = headers.authorization || headers.Authorization;
        
    let user;
    try {
      user = await verifyToken(authHeader);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }

    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid token" }),
      };
    }

    // Filter devices based on user role
    const filter = user.role === "manager" ? { branchId: user.branchId } : {};
    
    // Populate branchId with branch details (branchName)
    const devices = await DeviceAccess.find(filter)
      .populate('branchId', 'branchName')
      .lean();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(devices),
    };

  } catch (err) {
    console.error('Error in getDeviceAccessList:', err);
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

module.exports.updateDeviceAccess = async (event, context) => {
  // Add context configuration for consistency
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "PUT, PATCH, OPTIONS",
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
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    let user;
    try {
      const authHeader = headers.authorization || headers.Authorization;
      user = await verifyToken(authHeader);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid or expired token" }),
      };
    }

    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid token" }),
      };
    }

    // Parse request body
    console.log('Request body:', JSON.parse(event.body || "{}"));
    const body = JSON.parse(event.body || "{}");
    const { id } = event.pathParameters || {};

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device ID is required" }),
      };
    }

    // Find the device
    const device = await DeviceAccess.findById(id);
    if (!device) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Device not found" }),
      };
    }

    // Check authorization for managers
    if (user.role === "manager" && String(device.branchId) !== String(user.branchId)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Access denied" }),
      };
    }

    console.log('Processing update with body:', body);

    // Update basic device fields
    if (body.deviceName !== undefined) device.deviceName = body.deviceName;
    if (body.location !== undefined) device.location = body.location;
    if (body.password !== undefined) device.password = body.password;
    if (body.pin !== undefined) device.pin = body.pin;

    // Handle machine operations based on action
    if (body.action === 'assignMachine') {
      if (!body.machineId || !body.machineName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "machineId and machineName are required for assignMachine action" }),
        };
      }

      console.log('Assigning machine:', {
        machineId: body.machineId,
        machineName: body.machineName,
        machineType: body.machineType
      });

      // Check if machine already exists
      const existingMachineIndex = device.machines.findIndex(
        m => m.machineId.toString() === body.machineId.toString()
      );

      if (existingMachineIndex >= 0) {
        // Update existing machine
        console.log('Updating existing machine at index:', existingMachineIndex);
        device.machines[existingMachineIndex].machineName = body.machineName;
        if (body.machineType !== undefined) {
          device.machines[existingMachineIndex].machineType = body.machineType;
        }
      } else {
        // Add new machine
        console.log('Adding new machine to device');
        device.machines.push({
          machineId: body.machineId,
          machineName: body.machineName,
          machineType: body.machineType || null
        });
      }
      
      // Mark the machines array as modified for Mongoose
      device.markModified('machines');

    } else if (body.action === 'removeMachine') {
      if (!body.machineId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "machineId is required for removeMachine action" }),
        };
      }

      console.log('Removing machine:', body.machineId);
      const originalLength = device.machines.length;
      device.machines = device.machines.filter(
        m => m.machineId.toString() !== body.machineId.toString()
      );
      
      if (device.machines.length === originalLength) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Machine not found on this device" }),
        };
      }
      
      // Mark the machines array as modified for Mongoose
      device.markModified('machines');

    } else if (body.machines !== undefined && Array.isArray(body.machines)) {
      // Handle bulk machine updates (replace entire array)
      console.log('Bulk updating machines array');
      for (const machine of body.machines) {
        if (!machine.machineId || !machine.machineName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: "Each machine must have machineId and machineName" }),
          };
        }
      }
      device.machines = body.machines;
      device.markModified('machines');
    }

    console.log('Saving device with machines:', device.machines.length);
    await device.save();

    console.log('Device saved successfully');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(device),
    };

  } catch (err) {
    console.error('Error in updateDeviceAccess:', err);
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

module.exports.deleteDeviceAccess = async (event) => {
  await connect();
  const options = handleOptions(event);
  if (options) return options;

  if (!checkApiKey(event)) return respond(403, { message: "Invalid API key" });

  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    user = verifyToken(authHeader);
  } catch {
    return respond(401, { message: "Invalid token" });
  }

  const { id } = event.pathParameters || {};
  if (!id) return respond(400, { message: "Device ID is required" });

  try {
    const device = await DeviceAccess.findById(id);
    if (!device) return respond(404, { message: "Device not found" });

    if (user.role === "manager" && String(device.branchId) !== String(user.branchId)) {
      return respond(403, { message: "Access denied" });
    }

    await device.deleteOne();
    return respond(200, { message: "Device deleted successfully" });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};