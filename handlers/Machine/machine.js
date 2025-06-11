const Machine = require('../../models/Machine/machine');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const MachineType = require('../../models/MachineType/MachineType'); 
const Branch = require('../../models/Branch/Branch');
const mongoose = require("mongoose");
// ✅ CREATE MACHINE
module.exports.createMachine = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);
    
    if (user.role !== 'admin' && user.role !== 'manager') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Access denied' }) 
      };
    }
    
    // For managers, only allow creating machine in their own branch
    if (user.role === 'manager' && body.branchId !== user.branchId) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Cannot create machine in other branch' }) 
      };
    }
    
    // Check if machine name already exists
    const exists = await Machine.findOne({ machineName: body.machineName });
    if (exists) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Machine name must be unique' }) 
      };
    }
    
    // Validate that machineType exists
    const machineTypeExists = await MachineType.findById(body.machineType);
    if (!machineTypeExists) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Invalid machine type' }) 
      };
    }
    
    const machine = new Machine({
      machineName: body.machineName,
      machineType: body.machineType,
      sizeX: body.sizeX,
      sizeY: body.sizeY,
      sizeZ: body.sizeZ,
      branchId: body.branchId
    });
    
    await machine.save();
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Machine created successfully', 
        machine 
      })
    };
  } catch (err) {
    console.error('Create machine error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: err.message }) 
    };
  }
};

// ✅ GET ALL MACHINES
module.exports.getAllMachines = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const query = {};
    const params = event.queryStringParameters || {};

    // Role-based filtering
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    } else if (user.role === 'admin' && params.branchId) {
      // Validate branch existence for the provided branchId
      const branchExists = await Branch.findById(params.branchId);
      if (!branchExists) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid branch ID' }),
        };
      }
      query.branchId = params.branchId;
    }

    const machines = await Machine.find(query)
      .populate('machineType', 'type description')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        machines,
        count: machines.length,
      }),
    };
  } catch (err) {
    console.error('Get machines error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

// ✅ GET ONE MACHINE
module.exports.getOneMachine = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid machine ID' })
      };
    }
    
    const query = { _id: id };
    
    // Role-based filtering
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }
    
    const machine = await Machine.findOne(query)
      .populate('machineType', 'type description')
      .populate('branchId', 'name location');
    
    if (!machine) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Machine not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ machine })
    };
  } catch (err) {
    console.error('Get one machine error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message })
    };
  }
};

// ✅ UPDATE MACHINE
module.exports.updateMachine = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;
    const body = JSON.parse(event.body);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid machine ID' })
      };
    }
    
    if (user.role !== 'admin' && user.role !== 'manager') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Access denied' }) 
      };
    }
    
    const query = { _id: id };
    
    // Role-based filtering
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }
    
    // Check if machine exists and user has permission
    const existingMachine = await Machine.findOne(query);
    if (!existingMachine) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Machine not found or access denied' })
      };
    }
    
    // Check for unique machine name (excluding current machine)
    if (body.machineName && body.machineName !== existingMachine.machineName) {
      const nameExists = await Machine.findOne({ 
        machineName: body.machineName,
        _id: { $ne: id }
      });
      if (nameExists) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ message: 'Machine name must be unique' }) 
        };
      }
    }
    
    // Validate machineType if provided
    if (body.machineType) {
      const machineTypeExists = await MachineType.findById(body.machineType);
      if (!machineTypeExists) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ message: 'Invalid machine type' }) 
        };
      }
    }
    
    // For managers, ensure they can't change branchId to other branches
    if (user.role === 'manager' && body.branchId && body.branchId !== user.branchId) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Cannot move machine to other branch' }) 
      };
    }
    
    const updatedMachine = await Machine.findByIdAndUpdate(
      id,
      { ...body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('machineType', 'type description')
     .populate('branchId', 'name location');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Machine updated successfully', 
        machine: updatedMachine 
      })
    };
  } catch (err) {
    console.error('Update machine error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: err.message }) 
    };
  }
};

// ✅ DELETE MACHINE
module.exports.deleteMachine = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid machine ID' })
      };
    }
    
    if (user.role !== 'admin' && user.role !== 'manager') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Access denied' }) 
      };
    }
    
    const query = { _id: id };
    
    // Role-based filtering
    if (user.role === 'manager') {
      query.branchId = user.branchId;
    }
    
    const machine = await Machine.findOneAndDelete(query);
    
    if (!machine) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Machine not found or access denied' })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Machine deleted successfully',
        deletedMachine: machine
      })
    };
  } catch (err) {
    console.error('Delete machine error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: err.message }) 
    };
  }
};
