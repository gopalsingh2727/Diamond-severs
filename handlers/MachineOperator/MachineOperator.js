const mongoose = require('mongoose');
const Operator = require('../../models/MachineOperator/MachineOperator');
const Order = require('../../models/oders/oders');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const bcrypt = require('bcrypt');

const Machine = require('../../models/machine/machine');









const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  return apiKey === process.env.API_KEY;
};



module.exports.createOperator = async (event) => {
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Only admin or manager can create operators' });
    }

    const { username, pin, machineId, branchId } = JSON.parse(event.body);

    // Validation
    if (!username || !pin || !machineId || !branchId) {
      return respond(400, { message: 'All fields (username, pin, machineId, branchId) are required' });
    }

    // Validate PIN format (must be 4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return respond(400, { message: 'PIN must be exactly 4 digits' });
    }

    // Check if username already exists
    const existingOperator = await Operator.findOne({ username });
    if (existingOperator) {
      return respond(400, { message: 'Username already exists' });
    }

    // Check if PIN already exists in the same branch
    const existingPinInBranch = await Operator.findOne({ 
      pin: pin,  // For plain text comparison
      branchId: branchId 
    });

    if (existingPinInBranch) {
      return respond(400, { 
        message: 'This PIN is already used by another operator in this branch. Please choose a different PIN.' 
      });
    }

    // Verify machine exists
    const machine = await Machine.findById(machineId);
    if (!machine) {
      return respond(404, { message: 'Machine not found' });
    }

    // Optional: Verify branch exists if you have a Branch model
    // const branch = await Branch.findById(branchId);
    // if (!branch) {
    //   return respond(404, { message: 'Branch not found' });
    // }

    // Hash the PIN for security (recommended)
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create new operator
    const operator = new Operator({
      username,
      pin: hashedPin,  // Store hashed PIN
      machineId,
      branchId,
      role: 'operator',
    });

    await operator.save();

    return respond(201, { 
      message: 'Operator created successfully',
      operator: {
        id: operator._id,
        username: operator.username,
        machineId: operator.machineId,
        branchId: operator.branchId,
        role: operator.role
      }
    });

  } catch (err) {
    console.error('Error creating operator:', err);
    return respond(500, { 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
module.exports.getOperators = async (event) => {
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user) return respond(401, { message: 'Invalid token' });

    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    } else if (user.role === 'admin' && event.queryStringParameters?.branchId) {
      filter.branchId = event.queryStringParameters.branchId;
    }

    const operators = await Operator.find(filter);
    return respond(200, operators);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};
module.exports.updateOperator = async (event) => {
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Only admin or manager can update operators' });
    }

    const id = event.pathParameters.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid operator ID' });
    }

    const body = JSON.parse(event.body);
    const operator = await Operator.findById(id);
    if (!operator) return respond(404, { message: 'Operator not found' });

    if (user.role !== 'admin' && user.branchId !== String(operator.branchId)) {
      return respond(403, { message: 'Unauthorized to update this operator' });
    }

    if (body.username) operator.username = body.username;
    if (body.password) operator.password = await bcrypt.hash(body.password, 10);
    if (body.machineId) {
      const machine = await Machine.findById(body.machineId);
      if (!machine) return respond(404, { message: 'Machine not found' });

      operator.machineId = body.machineId;
      operator.machineName = machine.machineName;
      operator.machineType = machine.machineType;
    }

    await operator.save();
    return respond(200, { message: 'Operator updated successfully' });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};































