const mongoose = require('mongoose'); // ✅ Added this line
const Order = require('../../models/oders/oders');
const Branch = require('../../models/branch/branch');
const Step = require('../../models/steps/step');
const Machine = require('../../models/Machine/machine');
const verifyToken = require('../../utiles/verifyToken');
const connect = require('../../config/mongodb/db');


module.exports.createOrder = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const data = JSON.parse(event.body);

    // Basic required fields check (removed materialPercentage as it's not in schema)
    const requiredFields = ['customerId', 'productId', 'productSize', 'materialId',
      'materialWeight', 'productPieces', 'quantity', 'steps', 'branchId'];

    for (const field of requiredFields) {
      if (!data[field]) {
        return { statusCode: 400, body: JSON.stringify({ message: `${field} is required` }) };
      }
    }

    // Validate ObjectIds
    const objectIdFields = ['customerId', 'productId', 'materialId', 'branchId'];
    for (const idField of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(data[idField])) {
        return { statusCode: 400, body: JSON.stringify({ message: `Invalid ${idField}` }) };
      }
    }

    // Validate productSize structure
    if (!data.productSize || typeof data.productSize !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ message: 'productSize must be an object with sizeX, sizeY, sizeZ' }) };
    }
    
    const { sizeX, sizeY, sizeZ } = data.productSize;
    if (!sizeX || !sizeY || !sizeZ || typeof sizeX !== 'number' || typeof sizeY !== 'number' || typeof sizeZ !== 'number') {
      return { statusCode: 400, body: JSON.stringify({ message: 'productSize must contain numeric sizeX, sizeY, and sizeZ' }) };
    }

    // Validate steps is an array
    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Steps must be a non-empty array' }) };
    }

    // Validate branch
    const branch = await Branch.findById(data.branchId);
    if (!branch || !branch.code) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Branch not found or missing code' }) };
    }

    // Process multiple steps
    const stepsArray = [];
    for (const stepEntry of data.steps) {
      const stepId = stepEntry.stepId;
      if (!stepId || !mongoose.Types.ObjectId.isValid(stepId)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Invalid or missing stepId: ${stepId}` }),
        };
      }

      // Fetch Step document by stepId
      const stepDoc = await Step.findById(stepId).lean();
      if (!stepDoc) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Step not found: ${stepId}` }),
        };
      }

      // Fetch machine details for each machine in the step
      const machinesWithDetails = [];
      for (const m of stepDoc.machines) {
        if (!m.machineId || !mongoose.Types.ObjectId.isValid(m.machineId)) {
          return { 
            statusCode: 400, 
            body: JSON.stringify({ message: `Invalid machineId in step machines` }) 
          };
        }

        const machineDoc = await Machine.findById(m.machineId).lean();
        if (!machineDoc) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: `Machine not found: ${m.machineId}` }),
          };
        }

        machinesWithDetails.push({
          machineName: machineDoc.machineName,
          machineType: machineDoc.machineType,
          operatorId: null, // Will be assigned when operator is selected
          status: 'pending',
          startedAt: null,
          completedAt: null,
          reason: null
        });
      }

      // Add formatted step to array
      stepsArray.push({
        stepId: stepDoc._id,
        machines: machinesWithDetails,
      });
    }

    // Remove orderId generation since it's handled by pre-save middleware

    const newOrder = new Order({
      customerId: data.customerId,
      productId: data.productId,
      productSize: {
        sizeX: data.productSize.sizeX,
        sizeY: data.productSize.sizeY,
        sizeZ: data.productSize.sizeZ
      },
      materialId: data.materialId,
      materialWeight: data.materialWeight,
      productPieces: data.productPieces,
      quantity: data.quantity,
      steps: stepsArray,  // Now an array of steps
      branchId: data.branchId,
      createdBy: user.id,
      createdByRole: user.role
    });

    await newOrder.save();

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        message: 'Order created successfully', 
        orderId: newOrder.orderId,
        stepsCount: stepsArray.length
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};






module.exports.getOrdersByBranchId = async (event) => {
  await connect();
 return { body: JSON.stringify({ message: 'Invalid or misd' }) };
  // try {
  //   const authHeader = event.headers.authorization || event.headers.Authorization;
  //   const user = verifyToken(authHeader);

  //   if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
  //     return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
  //   }

  //   // 👇 Log the entire event to debug
  //   console.log("event.pathParameters:", event.pathParameters);

  //   const branchId = event.pathParameters?.branchId;

  //   if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
  //     return { statusCode: 400, body: JSON.stringify({ message: 'Invalid or missing branchId' }) };
  //   }

  //   const orders = await Order.find({ branchId }).lean();

  //   return {
  //     statusCode: 200,
  //     body: JSON.stringify({ orders }),
  //   };

  // } catch (err) {
  //   return {
  //     statusCode: 500,
  //     body: JSON.stringify({ message: err.message }),
  //   };
  // }
};