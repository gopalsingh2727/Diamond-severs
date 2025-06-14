const Step = require('../../models/steps/step');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const mongoose = require('mongoose');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  // Normalize headers to lowercase keys
  const headers = {};
  for (const key in event.headers) {
    headers[key.toLowerCase()] = event.headers[key];
  }
  return headers['x-api-key'] === process.env.API_KEY;
};

const getAuthHeader = (event) => {
  const headers = {};
  for (const key in event.headers) {
    headers[key.toLowerCase()] = event.headers[key];
  }
  return headers['authorization'] || null;
};

module.exports.createStep = async (event) => {
  await connect();

  // API key check
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  try {
    const authHeader = getAuthHeader(event);
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid or missing token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Only admin or manager can create steps' });
    }

    const body = JSON.parse(event.body);
    const { stepName, machines, branchId } = body;

    if (!stepName || !Array.isArray(machines) || machines.length === 0 || !branchId) {
      return respond(400, { message: 'stepName, machines, and branchId are required' });
    }

    if (user.role === 'manager' && branchId !== user.branchId) {
      return respond(403, { message: 'Manager can only create steps for their own branch' });
    }

    for (let i = 0; i < machines.length; i++) {
      if (typeof machines[i].sequence !== 'number') {
        return respond(400, { message: `Machine at index ${i} is missing 'sequence'` });
      }

      if (!machines[i].machineId || !mongoose.Types.ObjectId.isValid(machines[i].machineId)) {
        return respond(400, { message: `Machine at index ${i} has an invalid machineId` });
      }
    }

    const trimmedStepName = stepName.trim();

    const exists = await Step.findOne({
      stepName: { $regex: new RegExp(`^${trimmedStepName}$`, 'i') },
      branchId
    });

    if (exists) {
      return respond(400, { message: 'Step name already exists in this branch' });
    }

    machines.sort((a, b) => a.sequence - b.sequence);

    const step = new Step({
      stepName: trimmedStepName,
      machines,
      branchId,
    });

    await step.save();

    return respond(201, { message: 'Step created successfully', stepId: step._id });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

module.exports.updateStepStatus = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  try {
    const authHeader = getAuthHeader(event);
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid or missing token' });
    }

    if (user.role !== 'operator') {
      return respond(403, { message: 'Only operators can update step status' });
    }

    const { stepId, machineId, status, reason } = JSON.parse(event.body);
    const step = await Step.findById(stepId);
    if (!step) throw new Error("Step not found");

    const machine = step.machines.find(
      (m) => m.machineId.toString() === machineId && m.operatorId && m.operatorId.toString() === user.id
    );

    if (!machine) throw new Error("Machine entry not found or unauthorized");

    machine.status = status;
    if (status === 'start') machine.startedAt = new Date();
    if (status === 'complete') machine.completedAt = new Date();
    if (['stop', 'cancel'].includes(status)) machine.reason = reason;

    await step.save();

    return respond(200, { message: 'Status updated', step });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

module.exports.getOperatorSteps = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }

  try {
    const authHeader = getAuthHeader(event);
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid or missing token' });
    }

    if (user.role !== 'operator') {
      return respond(403, { message: 'Only operators can view this' });
    }

    const steps = await Step.find({ 'machines.operatorId': user.id })
      .populate('machines.machineId')
      .populate('orderId');

    return respond(200, { steps });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};