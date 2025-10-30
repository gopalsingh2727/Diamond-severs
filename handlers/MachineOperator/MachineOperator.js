const mongoose = require('mongoose');
const Operator = require('../../models/MachineOperator/MachineOperator');
const Order = require('../../models/oders/oders');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Machine = require('../../models/machine/machine');
const oders = require('../../models/oders/oders');
const Material = require('../../models/Material/material');
const Product = require('../../models/product/product');
const Step = require('../../models/steps/step');
const Customer = require('../../models/Customer/customer');










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

    const { username, password, machineId, branchId } = JSON.parse(event.body);

    if (!username || !password || !machineId || !branchId) {
      return respond(400, { message: 'All fields required' });
    }

    const exists = await Operator.findOne({ username });
    if (exists) return respond(400, { message: 'Operator already exists' });

    const machine = await Machine.findById(machineId);
    if (!machine) return respond(404, { message: 'Machine not found' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const operator = new Operator({
      username,
      password: hashedPassword,
      machineId,

    
      branchId,
      role: 'operator',
    });

    await operator.save();
    return respond(201, { message: 'Operator created successfully' });
  } catch (err) {
    return respond(500, { message: err.message });
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































