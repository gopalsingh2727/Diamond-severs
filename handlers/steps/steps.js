
const Step = require('../../models/steps/step');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const mongoose = require('mongoose');

module.exports.createStep = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only admin or manager can create steps' }),
      };
    }

    const { stepName, machines, branchId } = body;

    if (!stepName || !Array.isArray(machines) || machines.length === 0 || !branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'stepName, machines, and branchId are required' }),
      };
    }

    if (user.role === 'manager' && branchId !== user.branchId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Manager can only create steps for their own branch' }),
      };
    }


    for (let i = 0; i < machines.length; i++) {
      if (typeof machines[i].sequence !== 'number') {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Machine at index ${i} is missing 'sequence'` }),
        };
      }

      if (!machines[i].machineId || !mongoose.Types.ObjectId.isValid(machines[i].machineId)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Machine at index ${i} has an invalid machineId` }),
        };
      }
    }

    const trimmedStepName = stepName.trim();

    // Case-insensitive uniqueness check
    const exists = await Step.findOne({
      stepName: { $regex: new RegExp(`^${trimmedStepName}$`, 'i') },
      branchId
    });

    if (exists) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Step name already exists in this branch' }),
      };
    }

    // Sort machines by sequence for consistency
    machines.sort((a, b) => a.sequence - b.sequence);

    const step = new Step({
      stepName: trimmedStepName,
      machines,
      branchId,
    });

    await step.save();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Step created successfully', stepId: step._id }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

module.exports.updateStepStatus = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    if (user.role !== 'operator') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only operators can update step status' }),
      };
    }

    const { stepId, machineId, status, reason } = JSON.parse(event.body);
    const step = await Step.findById(stepId);
    if (!step) throw new Error("Step not found");

    const machine = step.machines.find(
      (m) => m.machineId.toString() === machineId && m.operatorId.toString() === user.id
    );

    if (!machine) throw new Error("Machine entry not found or unauthorized");

    machine.status = status;
    if (status === 'start') machine.startedAt = new Date();
    if (status === 'complete') machine.completedAt = new Date();
    if (['stop', 'cancel'].includes(status)) machine.reason = reason;

    await step.save();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Status updated', step }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

module.exports.getOperatorSteps = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    if (user.role !== 'operator') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only operators can view this' }),
      };
    }

    const steps = await Step.find({ 'machines.operatorId': user.id })
      .populate('machines.machineId')
      .populate('orderId');

    return {
      statusCode: 200,
      body: JSON.stringify({ steps }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};
