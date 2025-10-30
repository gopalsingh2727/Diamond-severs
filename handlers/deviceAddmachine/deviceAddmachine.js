const connect = require("../../config/mongodb/db");
const verifyToken = require('../../utiles/verifyToken');
const mongoose = require('mongoose');
const Machine = require('../../models/Machine/machine');
const DeviceAccess = require('../../models/deviceAccess/deviceAccess'); 
const Operator = require('../../models/MachineOperator/MachineOperator');
const jwt = require('jsonwebtoken');
const Order = require('../../models/oders/oders');
const Customer = require('../../models/Customer/customer');

// Helper functions
const handleOptions = (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }
  return null;
};



let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (error) {
  console.warn('bcryptjs not installed, falling back to plain text password comparison');
  bcrypt = null;
}

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  const expectedApiKey = process.env.API_KEY;
  return apiKey === expectedApiKey;
};

const respond = (statusCode, data) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

// Main function to get device machines
module.exports.getDeviceMachines = async (event) => {
  await connect();
  
  const options = handleOptions(event);
  if (options) return options;
  
  if (!checkApiKey(event)) {
    return respond(403, { message: "Invalid API key" });
  }
  
  let user;
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log("Get Device Machines Event:", authHeader);
    user = verifyToken(authHeader);
  } catch (error) {
    console.log("Token verification failed:", error.message);
    return respond(401, { message: "Invalid token" });
  }
  
  try {
    // Only allow devices to access this endpoint
    if (user.role !== 'device') {
      return respond(403, { message: "Access denied. Only devices can access this endpoint." });
    }
    
    console.log("Fetching machines for device ID:", user.id);
    
    // Find the device and get its machines (without populate for now)
    const deviceAccess = await DeviceAccess.findById(user.id);
    
    if (!deviceAccess) {
      return respond(404, { message: "Device not found" });
    }
    
    // Get machine details separately
    const machineIds = deviceAccess.machines.map(m => m.machineId);
    const machineDetails = await Machine.find({ _id: { $in: machineIds } });
    
    // Create a map for quick lookup
    const machineMap = {};
    machineDetails.forEach(machine => {
      machineMap[machine._id.toString()] = machine;
    });
    
   
    const machines = deviceAccess.machines.map(machine => {
      const machineDetail = machineMap[machine.machineId.toString()] || {};
      return {
        id: machine.machineId.toString(),
        machineName: machine.machineName,
        machineType: machine.machineType || machineDetail.machineType,
        status: machineDetail.status || 'active',
        location: machineDetail.location || deviceAccess.location,
        addedAt: machine.addedAt
      };
    });
    
    console.log(`Found ${machines.length} machines for device`);
    console.log("Machines:", machines);
    
    return respond(200, machines);
  } catch (err) {
    console.error("Error fetching device machines:", err);
    return respond(500, { message: err.message });
  }
};

module.exports.machineOperatorLogin = async (event) => {
  try {
    await connect();
    
    const options = handleOptions(event);
    if (options) return options;
    
    let user;
    try {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      console.log("Machine Operator Login Event:", authHeader);
      user = verifyToken(authHeader);
    } catch (error) {
      console.log("Token verification failed:", error.message);
      return respond(401, { message: "Invalid token" });
    }
    
    if (user.role !== 'device') {
      return respond(403, { message: "Access denied. Only devices can access this endpoint." });
    }
    
    console.log("Processing operator login for device ID:", user.id);
    
    const body = JSON.parse(event.body || '{}');
    const { pin, machineId } = body;
    
    if (!pin || !machineId) {
      return respond(400, { 
        success: false,
        message: "PIN and machine ID are required" 
      });
    }
    
    if (!/^\d{4}$/.test(pin)) {
      return respond(400, { 
        success: false,
        message: "PIN must be exactly 4 digits" 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return respond(400, { 
        success: false,
        message: "Invalid machine ID format" 
      });
    }
    
    const deviceAccess = await DeviceAccess.findById(user.id);
    if (!deviceAccess) {
      return respond(404, { 
        success: false,
        message: "Device not found" 
      });
    }
    
    console.log("Device found:", deviceAccess._id);
    
    const machine = await Machine.findOne({
      _id: machineId,
      status: { $ne: 'deleted' }
    });
    
    if (!machine) {
      return respond(404, { 
        success: false,
        message: "Machine not found or inactive" 
      });
    }
    
    console.log("Machine found:", machine.machineName);
    
    // Query operators without branch population to avoid the error
    let operators;
    try {
      operators = await Operator.find({
        machineId: machineId
      }).populate('machineId', 'machineName machineType location');
      
      // If you have Product27Infinity model, uncomment the next line
      // .populate('product27InfinityId');
      
    } catch (populateError) {
      console.error("Population error:", populateError);
      // Fallback: query without any population
      operators = await Operator.find({
        machineId: machineId
      });
    }
    
    if (!operators || operators.length === 0) {
      console.log("No operators found for machine:", machineId);
      return respond(401, { 
        success: false,
        message: "No operators authorized for this machine" 
      });
    }
    
    let validOperator = null;
    
    for (const operator of operators) {
      try {
        const isValidPin = await bcrypt.compare(pin, operator.password);
        if (isValidPin) {
          validOperator = operator;
          break;
        }
      } catch (bcryptError) {
        console.error("Bcrypt comparison error:", bcryptError);
        if (operator.password === pin) {
          validOperator = operator;
          break;
        }
      }
    }
    
    if (!validOperator) {
      console.log("Invalid PIN provided for machine:", machineId);
      return respond(401, { 
        success: false,
        message: "Invalid PIN" 
      });
    }
    
    console.log("Valid operator found:", validOperator.username);
    
    // Check machine authorization
    const operatorMachineId = validOperator.machineId?._id || validOperator.machineId;
    if (operatorMachineId.toString() !== machineId.toString()) {
      console.log("Machine ID mismatch - Operator machine:", operatorMachineId, "Requested:", machineId);
      return respond(403, { 
        success: false,
        message: "Operator not authorized for this machine" 
      });
    }
    
    // Check branch authorization if needed
    if (deviceAccess.branchId && validOperator.branchId && 
        validOperator.branchId.toString() !== deviceAccess.branchId.toString()) {
      return respond(403, { 
        success: false,
        message: "Operator not authorized for this branch" 
      });
    }
    
    const operatorToken = jwt.sign(
      {
        operatorId: validOperator._id,
        username: validOperator.username,
        machineId: operatorMachineId,
        branchId: validOperator.branchId || null,
        deviceId: deviceAccess._id,
        role: 'operator',
        type: 'machine_access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    // Get machine details safely
    const machineDetails = validOperator.machineId && validOperator.machineId.machineName 
      ? {
          name: validOperator.machineId.machineName,
          type: validOperator.machineId.machineType,
          location: validOperator.machineId.location
        }
      : {
          name: machine.machineName,
          type: machine.machineType,
          location: machine.location
        };
    
    const responseData = {
      success: true,
      message: "Operator login successful",
      operator: {
        id: validOperator._id,
        username: validOperator.username,
        role: validOperator.role,
        machineId: operatorMachineId,
        machineName: machineDetails.name,
        machineType: machineDetails.type,
        branchId: validOperator.branchId || null,
        branchName: null, // Can be fetched separately if Branch model exists
        product27InfinityId: validOperator.product27InfinityId || null
      },
      machine: {
        id: machine._id,
        name: machine.machineName,
        type: machine.machineType,
        location: machine.location
      },
      access: {
        token: operatorToken,
        expiresIn: '8h',
        loginTime: new Date().toISOString(),
        deviceId: deviceAccess._id
      }
    };
    
    console.log(`Operator ${validOperator.username} successfully logged in to machine ${machine.machineName} via device ${deviceAccess._id}`);
    
    return respond(200, responseData);
    
  } catch (err) {
    console.error("Error in machine operator login:", err);
    return respond(500, { 
      success: false,
      message: "Internal server error during operator login",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};



function checkCanStartMachine(order, stepIndex, machineProgress) {
  // If it's the first step, can always start
  if (stepIndex === 0) {
    return true;
  }

  // Check if all previous steps are completed
  for (let i = 0; i < stepIndex; i++) {
    const prevStep = order.steps[i];
    if (prevStep.stepStatus !== 'completed') {
      return false;
    }

    // Check if all machines in previous step are completed
    for (const prevMachine of prevStep.machines) {
      if (prevMachine.status !== 'completed') {
        return false;
      }
    }
  }

  // Check if current step's previous machines are completed (if any)
  const currentStep = order.steps[stepIndex];
  const machineIndex = currentStep.machines.findIndex(m => 
    m.machineId?._id.toString() === machineProgress.machineId?._id.toString()
  );

  if (machineIndex > 0) {
    // Check previous machines in same step
    for (let i = 0; i < machineIndex; i++) {
      if (currentStep.machines[i].status !== 'completed') {
        return false;
      }
    }
  }

  return true;
}


module.exports.getPendingOrders = async (event) => {
  await connect();
  
  try {
    // 1. Verify operator authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);
    
    if (!operatorData || operatorData.role !== 'operator') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ message: 'Unauthorized' }) 
      };
    }

    // Get request data
    const { machineId } = JSON.parse(event.body || "{}");
    if (!machineId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Machine ID is required' }) 
      };
    }

    // 2. Verify operator exists
    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ message: 'Operator not found' }) 
      };
    }

    // 3. Verify machine exists
    const machine = await Machine.findById(machineId);
    if (!machine) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ message: 'Machine not found' }) 
      };
    }

    // 4. Find orders where this operator's machine is the next pending step
    const pendingOrders = await Order.find({
      overallStatus: { $in: ['pending', 'in_progress', 'Wait for Approval'] }
    })
    .populate('customerId', 'name email')
    .populate('materialId', 'materialName materialMol')
    .populate('branchId', 'name code')
    .populate({
      path: 'steps.stepId',
      select: 'stepName'
    })
    .populate({
      path: 'steps.machines.machineId',
      select: 'machineName machineType'
    });

    // Filter and format orders for this specific operator and machine
    const relevantOrders = [];

    for (const order of pendingOrders) {
      const orderData = {
        orderId: order.orderId,
        customerName: order.customerName,
        materialWeight: order.materialWeight,
        dimensions: {
          width: order.Width,
          height: order.Height,
          thickness: order.Thickness
        },
        specifications: {
          sealingType: order.SealingType,
          bottomGusset: order.BottomGusset,
          flap: order.Flap,
          airHole: order.AirHole,
          printing: order.Printing,
          colors: order.colors
        },
        priority: order.priority,
        overallStatus: order.overallStatus,
        currentStepIndex: order.currentStepIndex,
        realTimeData: order.realTimeData,
        steps: [],
        currentMachineStep: null,
        previousMachineData: [],
        canStart: false
      };

      let foundRelevantMachine = false;
      let currentStepFound = false;

      // Process each step
      for (let stepIndex = 0; stepIndex < order.steps.length; stepIndex++) {
        const step = order.steps[stepIndex];
        
        const stepData = {
          stepIndex,
          stepName: step.stepName,
          stepStatus: step.stepStatus,
          stepStartedAt: step.stepStartedAt,
          stepCompletedAt: step.stepCompletedAt,
          machines: []
        };

        // Process each machine in the step
        for (const machineProgress of step.machines) {
          const machineData = {
            machineId: machineProgress.machineId?._id,
            machineName: machineProgress.machineId?.machineName,
            machineType: machineProgress.machineId?.machineType,
            status: machineProgress.status,
            operatorId: machineProgress.operatorId,
            operatorName: machineProgress.operatorName,
            startedAt: machineProgress.startedAt,
            completedAt: machineProgress.completedAt,
            calculatedOutput: machineProgress.calculatedOutput,
            targetOutput: machineProgress.targetOutput,
            qualityStatus: machineProgress.qualityStatus,
            note: machineProgress.note,
            reason: machineProgress.reason
          };

          // Check if this is the operator's current machine
          if (machineProgress.machineId?._id.toString() === machineId.toString()) {
            
            // Check if this machine is assigned to this operator or available
            const isAssignedToOperator = machineProgress.operatorId?.toString() === operator._id.toString();
            const isAvailable = !machineProgress.operatorId && machineProgress.status === 'pending';
            
            if (isAssignedToOperator || isAvailable) {
              // Check if this is the current step or next available step
              const isPendingOrInProgress = ['pending', 'in-progress'].includes(machineProgress.status);
              const isCurrentOrNextStep = stepIndex === order.currentStepIndex || 
                (stepIndex === order.currentStepIndex + 1 && step.stepStatus === 'pending');

              if (isPendingOrInProgress && isCurrentOrNextStep) {
                foundRelevantMachine = true;
                currentStepFound = true;
                orderData.currentMachineStep = {
                  stepIndex,
                  stepName: step.stepName,
                  machineData: machineData
                };

                // Check if previous steps are completed (can start condition)
                const canStart = this.checkCanStartMachine(order, stepIndex, machineProgress);
                orderData.canStart = canStart;
              }
            }
          }

          stepData.machines.push(machineData);
        }

        orderData.steps.push(stepData);

        // Collect previous machine data for context
        if (stepIndex < order.currentStepIndex || 
           (stepIndex === order.currentStepIndex && step.stepStatus === 'completed')) {
          
          for (const machineProgress of step.machines) {
            if (machineProgress.status === 'completed' && machineProgress.calculatedOutput) {
              
              // Get machine table data for detailed history
              const tableData = await MachineTableData.findById(machineProgress.machineTableDataId)
                .select('totalCalculations rowData status notes lastCalculatedAt');

              orderData.previousMachineData.push({
                stepIndex,
                stepName: step.stepName,
                machineName: machineProgress.machineId?.machineName,
                operatorName: machineProgress.operatorName,
                completedAt: machineProgress.completedAt,
                calculatedOutput: machineProgress.calculatedOutput,
                tableData: tableData ? {
                  totalCalculations: tableData.totalCalculations,
                  totalRows: tableData.rowData?.length || 0,
                  status: tableData.status,
                  lastCalculatedAt: tableData.lastCalculatedAt,
                  latestNotes: tableData.notes?.slice(-3) || [] // Last 3 notes
                } : null,
                qualityStatus: machineProgress.qualityStatus
              });
            }
          }
        }
      }

      // Only include orders where this operator's machine has pending work
      if (foundRelevantMachine) {
        relevantOrders.push(orderData);
      }
    }

    // Sort orders by priority and scheduled dates
    relevantOrders.sort((a, b) => {
      const priorityOrder = { 'urgent': 4, 'high': 3, 'normal': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // If same priority, sort by order creation (older first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          operator: {
            id: operator._id,
            name: operator.name,
            operatorId: operator.operatorId
          },
          machine: {
            id: machine._id,
            name: machine.machineName,
            type: machine.machineType
          },
          pendingOrders: relevantOrders,
          totalOrders: relevantOrders.length,
          summary: {
            canStartNow: relevantOrders.filter(order => order.canStart).length,
            waitingForPrevious: relevantOrders.filter(order => !order.canStart).length,
            urgentOrders: relevantOrders.filter(order => order.priority === 'urgent').length,
            highPriorityOrders: relevantOrders.filter(order => order.priority === 'high').length
          }
        }
      })
    };

  } catch (error) {
    console.error('Error in getPendingOrders:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};

module.exports.machineAllPendingOrders = async (event) => {
  await connect();
  
  try {
    console.log("=== machineAllPendingOrders Function Started ===");
    
    // Get machine ID from request body
    const { machineId } = JSON.parse(event.body || "{}");
    if (!machineId) {
      return { 
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Machine ID is required' 
        }) 
      };
    }

    console.log('🔍 Fetching pending orders for machine:', machineId);

    // Validate machine ID format
    if (!mongoose.Types.ObjectId.isValid(machineId)) {
      return { 
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid machine ID format' 
        }) 
      };
    }

    const machineObjectId = new mongoose.Types.ObjectId(machineId);

    // Verify machine exists
    const machine = await Machine.findById(machineObjectId);
    if (!machine) {
      return { 
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Machine not found' 
        }) 
      };
    }

    console.log('✅ Machine found:', machine.machineName);

    // Build aggregation pipeline with COMPLETE order details
    const pipeline = [
      // FIXED: Match orders that contain this SPECIFIC machine with pending/in-progress status
      // Using $elemMatch ensures BOTH conditions apply to the SAME machine object
      {
        $match: {
          overallStatus: { $in: ['pending', 'in_progress', 'Wait for Approval'] },
          'steps.machines': {
            $elemMatch: {
              machineId: machineObjectId,
              status: { $in: ['pending', 'in-progress'] }
            }
          }
        }
      },
      
      // Lookup customer details
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
          pipeline: [
            {
              $project: {
                companyName: 1,
                firstName: 1,
                lastName: 1,
                phone1: 1,
                phone2: 1,
                whatsapp: 1,
                telephone: 1,
                address1: 1,
                address2: 1,
                state: 1,
                pinCode: 1,
                email: 1,
                imageUrl: 1,
                product27InfinityId: 1
              }
            }
          ]
        }
      },
      
      // Lookup branch details
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branch',
          pipeline: [
            { $project: { name: 1, code: 1, address: 1, phone: 1, email: 1 } }
          ]
        }
      },
      
      // Lookup material details with material type
      {
        $lookup: {
          from: 'materials',
          localField: 'materialId',
          foreignField: '_id',
          as: 'material',
          pipeline: [
            {
              $lookup: {
                from: 'materialtypes',
                localField: 'materialType',
                foreignField: '_id',
                as: 'materialTypeDetails'
              }
            },
            {
              $project: {
                materialName: 1,
                materialMol: 1,
                materialType: 1,
                materialTypeName: {
                  $arrayElemAt: ['$materialTypeDetails.materialTypeName', 0]
                }
              }
            }
          ]
        }
      },
      
      // Handle mix materials if they exist
      {
        $lookup: {
          from: 'materials',
          let: {
            mixMaterialIds: {
              $cond: {
                if: { $and: [
                  { $ne: ['$mixMaterial', null] },
                  { $ne: ['$mixMaterial', []] },
                  { $isArray: '$mixMaterial' }
                ]},
                then: {
                  $map: {
                    input: '$mixMaterial',
                    as: 'mix',
                    in: '$$mix.materialId'
                  }
                },
                else: []
              }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$mixMaterialIds', null] },
                    { $ne: ['$$mixMaterialIds', []] },
                    { $in: ['$_id', '$$mixMaterialIds'] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'materialtypes',
                localField: 'materialType',
                foreignField: '_id',
                as: 'materialTypeDetails'
              }
            },
            {
              $project: {
                materialName: 1,
                materialMol: 1,
                materialTypeName: {
                  $arrayElemAt: ['$materialTypeDetails.materialTypeName', 0]
                }
              }
            }
          ],
          as: 'mixMaterialDetails'
        }
      },
      
      // Extract all machine IDs from steps
      {
        $addFields: {
          allMachineIds: {
            $cond: {
              if: { $and: [
                { $ne: ['$steps', null] },
                { $ne: ['$steps', []] },
                { $isArray: '$steps' }
              ]},
              then: {
                $reduce: {
                  input: '$steps',
                  initialValue: [],
                  in: {
                    $cond: {
                      if: { $and: [
                        { $ne: ['$$this.machines', null] },
                        { $ne: ['$$this.machines', []] },
                        { $isArray: '$$this.machines' }
                      ]},
                      then: {
                        $concatArrays: [
                          '$$value',
                          {
                            $map: {
                              input: '$$this.machines',
                              as: 'machine',
                              in: '$$machine.machineId'
                            }
                          }
                        ]
                      },
                      else: '$$value'
                    }
                  }
                }
              },
              else: []
            }
          }
        }
      },
      
      // Lookup all machine details at once
      {
        $lookup: {
          from: 'machines',
          let: { machineIds: '$allMachineIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$machineIds', null] },
                    { $ne: ['$$machineIds', []] },
                    { $in: ['$_id', '$$machineIds'] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'machinetypes',
                localField: 'machineType',
                foreignField: '_id',
                as: 'machineTypeDetails'
              }
            },
            {
              $project: {
                machineName: 1,
                machineType: 1,
                machineTypeName: {
                  $arrayElemAt: ['$machineTypeDetails.type', 0]
                },
                machineTypeDescription: {
                  $arrayElemAt: ['$machineTypeDetails.description', 0]
                },
                sizeX: 1,
                sizeY: 1,
                sizeZ: 1
              }
            }
          ],
          as: 'allMachineDetails'
        }
      },
      
      // Lookup step details
      {
        $lookup: {
          from: 'steps',
          let: {
            stepIds: {
              $cond: {
                if: { $and: [
                  { $ne: ['$steps', null] },
                  { $ne: ['$steps', []] },
                  { $isArray: '$steps' }
                ]},
                then: {
                  $map: {
                    input: '$steps',
                    as: 'step',
                    in: '$$step.stepId'
                  }
                },
                else: []
              }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$stepIds', null] },
                    { $ne: ['$$stepIds', []] },
                    { $in: ['$_id', '$$stepIds'] }
                  ]
                }
              }
            },
            {
              $project: {
                stepName: 1,
                machines: 1,
                description: 1
              }
            }
          ],
          as: 'stepDetails'
        }
      },
      
      // Lookup creator details
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
          pipeline: [
            { $project: { username: 1, email: 1, role: 1, firstName: 1, lastName: 1 } }
          ]
        }
      },
      
      // Process and enrich the data
      {
        $addFields: {
          customer: { $arrayElemAt: ['$customer', 0] },
          branch: { $arrayElemAt: ['$branch', 0] },
          material: { $arrayElemAt: ['$material', 0] },
          creator: { $arrayElemAt: ['$creator', 0] },
          
          mixMaterialsWithDetails: {
            $cond: {
              if: { $and: [
                { $ne: ['$mixMaterial', null] },
                { $ne: ['$mixMaterial', []] },
                { $isArray: '$mixMaterial' }
              ]},
              then: {
                $map: {
                  input: '$mixMaterial',
                  as: 'mix',
                  in: {
                    materialWeight: '$$mix.materialWeight',
                    materialDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $ifNull: ['$mixMaterialDetails', []] },
                            as: 'detail',
                            cond: { $eq: ['$$detail._id', '$$mix.materialId'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                }
              },
              else: []
            }
          },
          
          steps: {
            $cond: {
              if: { $and: [
                { $ne: ['$steps', null] },
                { $ne: ['$steps', []] },
                { $isArray: '$steps' }
              ]},
              then: {
                $map: {
                  input: '$steps',
                  as: 'step',
                  in: {
                    stepId: '$$step.stepId',
                    _id: '$$step._id',
                    stepDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $ifNull: ['$stepDetails', []] },
                            as: 'detail',
                            cond: { $eq: ['$$detail._id', '$$step.stepId'] }
                          }
                        },
                        0
                      ]
                    },
                    machines: {
                      $cond: {
                        if: { $and: [
                          { $ne: ['$$step.machines', null] },
                          { $ne: ['$$step.machines', []] },
                          { $isArray: '$$step.machines' }
                        ]},
                        then: {
                          $map: {
                            input: '$$step.machines',
                            as: 'machine',
                            in: {
                              _id: '$$machine._id',
                              machineId: '$$machine.machineId',
                              operatorId: '$$machine.operatorId',
                              status: '$$machine.status',
                              startedAt: '$$machine.startedAt',
                              completedAt: '$$machine.completedAt',
                              note: '$$machine.note',
                              reason: '$$machine.reason',
                              machineDetails: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: {
                                    machineName: { $ifNull: ['$$machineInfo.machineName', 'Machine Not Found'] },
                                    machineType: '$$machineInfo.machineType',
                                    machineTypeName: { $ifNull: ['$$machineInfo.machineTypeName', 'Type Not Found'] },
                                    machineTypeDescription: { $ifNull: ['$$machineInfo.machineTypeDescription', 'No Description'] },
                                    sizeX: { $ifNull: ['$$machineInfo.sizeX', '0'] },
                                    sizeY: { $ifNull: ['$$machineInfo.sizeY', '0'] },
                                    sizeZ: { $ifNull: ['$$machineInfo.sizeZ', '0'] }
                                  }
                                }
                              },
                              machineName: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: { $ifNull: ['$$machineInfo.machineName', 'Machine Not Found'] }
                                }
                              },
                              machineTypeName: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: { $ifNull: ['$$machineInfo.machineTypeName', 'Type Not Found'] }
                                }
                              },
                              sizeX: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: { $ifNull: ['$$machineInfo.sizeX', '0'] }
                                }
                              },
                              sizeY: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: { $ifNull: ['$$machineInfo.sizeY', '0'] }
                                }
                              },
                              sizeZ: {
                                $let: {
                                  vars: {
                                    machineInfo: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: { $ifNull: ['$allMachineDetails', []] },
                                            as: 'machineDetail',
                                            cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
                                          }
                                        },
                                        0
                                      ]
                                    }
                                  },
                                  in: { $ifNull: ['$$machineInfo.sizeZ', '0'] }
                                }
                              }
                            }
                          }
                        },
                        else: []
                      }
                    }
                  }
                }
              },
              else: []
            }
          },
          
          totalSteps: { 
            $size: { 
              $cond: {
                if: { $isArray: '$steps' },
                then: '$steps',
                else: []
              }
            } 
          },
          completedSteps: {
            $size: {
              $filter: {
                input: { 
                  $cond: {
                    if: { $isArray: '$steps' },
                    then: '$steps',
                    else: []
                  }
                },
                as: 'step',
                cond: {
                  $cond: {
                    if: { $and: [
                      { $ne: ['$$step.machines', null] },
                      { $ne: ['$$step.machines', []] },
                      { $isArray: '$$step.machines' }
                    ]},
                    then: {
                      $allElementsTrue: {
                        $map: {
                          input: '$$step.machines',
                          as: 'machine',
                          in: { $eq: ['$$machine.status', 'completed'] }
                        }
                      }
                    },
                    else: false
                  }
                }
              }
            }
          }
        }
      },
      
      {
        $addFields: {
          progressPercentage: {
            $cond: [
              { $gt: ['$totalSteps', 0] },
              {
                $multiply: [
                  { $divide: ['$completedSteps', '$totalSteps'] },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      
      {
        $project: {
          allMachineIds: 0,
          allMachineDetails: 0,
          stepDetails: 0,
          mixMaterialDetails: 0
        }
      },
      
      { 
        $sort: { 
          priority: -1,
          createdAt: 1 
        } 
      }
    ];

    console.log("🚀 Executing aggregation pipeline for machine pending orders...");
    console.log("🔍 Machine ID:", machineObjectId);

    const startTime = Date.now();
    const orders = await Order.aggregate(pipeline).allowDiskUse(true).exec();
    const queryTime = Date.now() - startTime;

    console.log(`⚡ Query executed in ${queryTime}ms`);
    console.log(`📦 Found ${orders.length} pending orders for machine`);

    // Calculate summary statistics
    const summary = {
      totalPendingOrders: orders.length,
      urgentOrders: orders.filter(order => order.priority === 'urgent').length,
      highPriorityOrders: orders.filter(order => order.priority === 'high').length,
      normalPriorityOrders: orders.filter(order => order.priority === 'normal').length,
      byStatus: {
        pending: orders.filter(order => order.overallStatus === 'pending').length,
        inProgress: orders.filter(order => order.overallStatus === 'in_progress').length,
        waitForApproval: orders.filter(order => order.overallStatus === 'Wait for Approval').length
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        data: {
          machine: {
            id: machine._id,
            name: machine.machineName,
            type: machine.machineType
          },
          orders: orders,
          summary: summary,
          meta: {
            queryTime,
            timestamp: new Date().toISOString(),
            machineId: machineId
          }
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in machineAllPendingOrders:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};

module.exports.startOrdersMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== startMachine Function Started ===");
    
    // Get data from request body
    const { orderId, stepIndex, machineId, operatorId } = JSON.parse(event.body || "{}");
    
    // Validate required fields
    if (!orderId || stepIndex === undefined || !machineId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'orderId, stepIndex, and machineId are required'
        })
      };
    }

    console.log('🔍 Starting machine:', {
      orderId,
      stepIndex,
      machineId,
      operatorId
    });

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(machineId)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid orderId or machineId format'
        })
      };
    }

    // Validate operator if provided
    if (operatorId && !mongoose.Types.ObjectId.isValid(operatorId)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid operatorId format'
        })
      };
    }

    // Fetch the order - FIXED: Don't populate MachineType
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Order not found'
        })
      };
    }

    console.log('✅ Order found:', order.orderId);

    // Validate step index
    if (stepIndex < 0 || stepIndex >= order.steps.length) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: `Invalid step index. Order has ${order.steps.length} steps`
        })
      };
    }

    const step = order.steps[stepIndex];
    console.log('✅ Step found:', step.stepId);

    // Find the machine in the step
    const machineIndex = step.machines.findIndex(
      m => m.machineId.toString() === machineId.toString()
    );

    if (machineIndex === -1) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Machine not found in this step'
        })
      };
    }

    const machine = step.machines[machineIndex];
    console.log('✅ Machine found in step:', machine.machineId);

    // Check if machine is in pending status
    if (machine.status !== 'pending') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: `Machine status is '${machine.status}'. Only machines with 'pending' status can be started.`
        })
      };
    }

    // Start the machine - change status to in-progress
    machine.status = 'in-progress';
    machine.startedAt = new Date();
    machine.operatorId = operatorId || machine.operatorId;

    // Update step status if not already in progress
    if (step.stepStatus !== 'in-progress') {
      step.stepStatus = 'in-progress';
      step.stepStartedAt = new Date();
    }

    // Update overall order status if not already in progress
    if (order.overallStatus === 'Wait for Approval' || order.overallStatus === 'pending') {
      order.overallStatus = 'in_progress';
      order.actualStartDate = new Date();
    }

    // Save the updated order
    await order.save();

    console.log('✅ Machine status updated to in-progress');
    console.log('📊 Updated Order State:', {
      orderId: order.orderId,
      overallStatus: order.overallStatus,
      stepStatus: step.stepStatus,
      machineStatus: machine.status,
      machineStartedAt: machine.startedAt,
      operatorId: machine.operatorId
    });

    // FIXED: Fetch machine details WITHOUT populate to avoid MachineType schema error
    const machineDetails = await Machine.findById(machineId).lean();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Machine started successfully',
        data: {
          order: {
            id: order._id,
            orderId: order.orderId,
            overallStatus: order.overallStatus,
            actualStartDate: order.actualStartDate,
            currentStepIndex: order.currentStepIndex,
            steps: order.steps.map((s, idx) => ({
              stepIndex: idx,
              stepId: s.stepId,
              stepStatus: s.stepStatus,
              stepStartedAt: s.stepStartedAt,
              machinesCount: s.machines.length,
              machines: s.machines.map((m, mIdx) => ({
                index: mIdx,
                machineId: m.machineId,
                machineName: m.machineName,
                status: m.status,
                startedAt: m.startedAt,
                operatorId: m.operatorId
              }))
            }))
          },
          machine: {
            machineId: machine.machineId,
            machineName: machine.machineName,
            previousStatus: 'pending',
            currentStatus: machine.status,
            startedAt: machine.startedAt,
            operatorId: machine.operatorId,
            machineDetails: machineDetails ? {
              name: machineDetails.machineName,
              type: machineDetails.machineType,
              sizeX: machineDetails.sizeX,
              sizeY: machineDetails.sizeY,
              sizeZ: machineDetails.sizeZ
            } : null
          },
          machineSequence: step.machines.map((m, idx) => ({
            index: idx,
            machineId: m.machineId,
            machineName: m.machineName,
            status: m.status,
            isCurrentMachine: m.machineId.toString() === machineId.toString()
          })),
          meta: {
            timestamp: new Date().toISOString(),
            updatedAt: order.updatedAt,
            stepIndex: stepIndex
          }
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in startMachine:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
// module.exports.machineAllPendingOrders = async (event) => {
//   await connect();
  
//   try {
//     console.log("=== machineAllPendingOrders Function Started ===");
    
//     // Get machine ID from request body
//     const { machineId } = JSON.parse(event.body || "{}");
//     if (!machineId) {
//       return { 
//         statusCode: 400,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         },
//         body: JSON.stringify({ 
//           success: false,
//           message: 'Machine ID is required' 
//         }) 
//       };
//     }

//     console.log('🔍 Fetching pending orders for machine:', machineId);

//     // Validate machine ID format
//     if (!mongoose.Types.ObjectId.isValid(machineId)) {
//       return { 
//         statusCode: 400,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         },
//         body: JSON.stringify({ 
//           success: false,
//           message: 'Invalid machine ID format' 
//         }) 
//       };
//     }

//     const machineObjectId = new mongoose.Types.ObjectId(machineId);

//     // Verify machine exists
//     const machine = await Machine.findById(machineObjectId);
//     if (!machine) {
//       return { 
//         statusCode: 404,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         },
//         body: JSON.stringify({ 
//           success: false,
//           message: 'Machine not found' 
//         }) 
//       };
//     }

//     console.log('✅ Machine found:', machine.machineName);

//     // Build aggregation pipeline - SAME AS getAllOrders but filtered for specific machine
//     const pipeline = [
//       // Match orders that contain this machine
//       {
//         $match: {
//           overallStatus: { $in: ['pending', 'in_progress', 'Wait for Approval'] },
//           'steps.machines.machineId': machineObjectId,
//           'steps.machines.status': { $in: ['pending', 'in-progress'] }
//         }
//       },
      
//       // Lookup customer details
//       {
//         $lookup: {
//           from: 'customers',
//           localField: 'customerId',
//           foreignField: '_id',
//           as: 'customer',
//           pipeline: [
//             {
//               $project: {
//                 companyName: 1,
//                 firstName: 1,
//                 lastName: 1,
//                 phone1: 1,
//                 phone2: 1,
//                 whatsapp: 1,
//                 telephone: 1,
//                 address1: 1,
//                 address2: 1,
//                 state: 1,
//                 pinCode: 1,
//                 email: 1,
//                 imageUrl: 1,
//                 product27InfinityId: 1
//               }
//             }
//           ]
//         }
//       },
      
//       // Lookup branch details
//       {
//         $lookup: {
//           from: 'branches',
//           localField: 'branchId',
//           foreignField: '_id',
//           as: 'branch',
//           pipeline: [
//             { $project: { name: 1, code: 1, address: 1, phone: 1, email: 1 } }
//           ]
//         }
//       },
      
//       // Lookup material details with material type
//       {
//         $lookup: {
//           from: 'materials',
//           localField: 'materialId',
//           foreignField: '_id',
//           as: 'material',
//           pipeline: [
//             {
//               $lookup: {
//                 from: 'materialtypes',
//                 localField: 'materialType',
//                 foreignField: '_id',
//                 as: 'materialTypeDetails'
//               }
//             },
//             {
//               $project: {
//                 materialName: 1,
//                 materialMol: 1,
//                 materialType: 1,
//                 materialTypeName: {
//                   $arrayElemAt: ['$materialTypeDetails.materialTypeName', 0]
//                 }
//               }
//             }
//           ]
//         }
//       },
      
//       // Handle mix materials if they exist
//       {
//         $lookup: {
//           from: 'materials',
//           let: {
//             mixMaterialIds: {
//               $cond: {
//                 if: { $and: [
//                   { $ne: ['$mixMaterial', null] },
//                   { $ne: ['$mixMaterial', []] },
//                   { $isArray: '$mixMaterial' }
//                 ]},
//                 then: {
//                   $map: {
//                     input: '$mixMaterial',
//                     as: 'mix',
//                     in: '$$mix.materialId'
//                   }
//                 },
//                 else: []
//               }
//             }
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $ne: ['$$mixMaterialIds', null] },
//                     { $ne: ['$$mixMaterialIds', []] },
//                     { $in: ['$_id', '$$mixMaterialIds'] }
//                   ]
//                 }
//               }
//             },
//             {
//               $lookup: {
//                 from: 'materialtypes',
//                 localField: 'materialType',
//                 foreignField: '_id',
//                 as: 'materialTypeDetails'
//               }
//             },
//             {
//               $project: {
//                 materialName: 1,
//                 materialMol: 1,
//                 materialTypeName: {
//                   $arrayElemAt: ['$materialTypeDetails.materialTypeName', 0]
//                 }
//               }
//             }
//           ],
//           as: 'mixMaterialDetails'
//         }
//       },
      
//       // Extract all machine IDs from steps
//       {
//         $addFields: {
//           allMachineIds: {
//             $cond: {
//               if: { $and: [
//                 { $ne: ['$steps', null] },
//                 { $ne: ['$steps', []] },
//                 { $isArray: '$steps' }
//               ]},
//               then: {
//                 $reduce: {
//                   input: '$steps',
//                   initialValue: [],
//                   in: {
//                     $cond: {
//                       if: { $and: [
//                         { $ne: ['$$this.machines', null] },
//                         { $ne: ['$$this.machines', []] },
//                         { $isArray: '$$this.machines' }
//                       ]},
//                       then: {
//                         $concatArrays: [
//                           '$$value',
//                           {
//                             $map: {
//                               input: '$$this.machines',
//                               as: 'machine',
//                               in: '$$machine.machineId'
//                             }
//                           }
//                         ]
//                       },
//                       else: '$$value'
//                     }
//                   }
//                 }
//               },
//               else: []
//             }
//           }
//         }
//       },
      
//       // Lookup all machine details at once
//       {
//         $lookup: {
//           from: 'machines',
//           let: { machineIds: '$allMachineIds' },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $ne: ['$$machineIds', null] },
//                     { $ne: ['$$machineIds', []] },
//                     { $in: ['$_id', '$$machineIds'] }
//                   ]
//                 }
//               }
//             },
//             {
//               $lookup: {
//                 from: 'machinetypes',
//                 localField: 'machineType',
//                 foreignField: '_id',
//                 as: 'machineTypeDetails'
//               }
//             },
//             {
//               $project: {
//                 machineName: 1,
//                 machineType: 1,
//                 machineTypeName: {
//                   $arrayElemAt: ['$machineTypeDetails.type', 0]
//                 },
//                 machineTypeDescription: {
//                   $arrayElemAt: ['$machineTypeDetails.description', 0]
//                 },
//                 sizeX: 1,
//                 sizeY: 1,
//                 sizeZ: 1
//               }
//             }
//           ],
//           as: 'allMachineDetails'
//         }
//       },
      
//       // Lookup step details
//       {
//         $lookup: {
//           from: 'steps',
//           let: {
//             stepIds: {
//               $cond: {
//                 if: { $and: [
//                   { $ne: ['$steps', null] },
//                   { $ne: ['$steps', []] },
//                   { $isArray: '$steps' }
//                 ]},
//                 then: {
//                   $map: {
//                     input: '$steps',
//                     as: 'step',
//                     in: '$$step.stepId'
//                   }
//                 },
//                 else: []
//               }
//             }
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $ne: ['$$stepIds', null] },
//                     { $ne: ['$$stepIds', []] },
//                     { $in: ['$_id', '$$stepIds'] }
//                   ]
//                 }
//               }
//             },
//             {
//               $project: {
//                 stepName: 1,
//                 machines: 1,
//                 description: 1
//               }
//             }
//           ],
//           as: 'stepDetails'
//         }
//       },
      
//       // Lookup creator details
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'createdBy',
//           foreignField: '_id',
//           as: 'creator',
//           pipeline: [
//             { $project: { username: 1, email: 1, role: 1, firstName: 1, lastName: 1 } }
//           ]
//         }
//       },
      
//       // Process and enrich the data
//       {
//         $addFields: {
//           // Flatten single document arrays
//           customer: { $arrayElemAt: ['$customer', 0] },
//           branch: { $arrayElemAt: ['$branch', 0] },
//           material: { $arrayElemAt: ['$material', 0] },
//           creator: { $arrayElemAt: ['$creator', 0] },
          
//           // Process mix materials with weights
//           mixMaterialsWithDetails: {
//             $cond: {
//               if: { $and: [
//                 { $ne: ['$mixMaterial', null] },
//                 { $ne: ['$mixMaterial', []] },
//                 { $isArray: '$mixMaterial' }
//               ]},
//               then: {
//                 $map: {
//                   input: '$mixMaterial',
//                   as: 'mix',
//                   in: {
//                     materialWeight: '$$mix.materialWeight',
//                     materialDetails: {
//                       $arrayElemAt: [
//                         {
//                           $filter: {
//                             input: { $ifNull: ['$mixMaterialDetails', []] },
//                             as: 'detail',
//                             cond: { $eq: ['$$detail._id', '$$mix.materialId'] }
//                           }
//                         },
//                         0
//                       ]
//                     }
//                   }
//                 }
//               },
//               else: []
//             }
//           },
          
//           // Process steps with complete machine information
//           steps: {
//             $cond: {
//               if: { $and: [
//                 { $ne: ['$steps', null] },
//                 { $ne: ['$steps', []] },
//                 { $isArray: '$steps' }
//               ]},
//               then: {
//                 $map: {
//                   input: '$steps',
//                   as: 'step',
//                   in: {
//                     stepId: '$$step.stepId',
//                     _id: '$$step._id',
//                     // Get step details
//                     stepDetails: {
//                       $arrayElemAt: [
//                         {
//                           $filter: {
//                             input: { $ifNull: ['$stepDetails', []] },
//                             as: 'detail',
//                             cond: { $eq: ['$$detail._id', '$$step.stepId'] }
//                           }
//                         },
//                         0
//                       ]
//                     },
//                     // Process machines with complete details
//                     machines: {
//                       $cond: {
//                         if: { $and: [
//                           { $ne: ['$$step.machines', null] },
//                           { $ne: ['$$step.machines', []] },
//                           { $isArray: '$$step.machines' }
//                         ]},
//                         then: {
//                           $map: {
//                             input: '$$step.machines',
//                             as: 'machine',
//                             in: {
//                               _id: '$$machine._id',
//                               machineId: '$$machine.machineId',
//                               operatorId: '$$machine.operatorId',
//                               status: '$$machine.status',
//                               startedAt: '$$machine.startedAt',
//                               completedAt: '$$machine.completedAt',
//                               note: '$$machine.note',
//                               reason: '$$machine.reason',
//                               // Get machine details from lookup
//                               machineDetails: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: {
//                                     machineName: { $ifNull: ['$$machineInfo.machineName', 'Machine Not Found'] },
//                                     machineType: '$$machineInfo.machineType',
//                                     machineTypeName: { $ifNull: ['$$machineInfo.machineTypeName', 'Type Not Found'] },
//                                     machineTypeDescription: { $ifNull: ['$$machineInfo.machineTypeDescription', 'No Description'] },
//                                     sizeX: { $ifNull: ['$$machineInfo.sizeX', '0'] },
//                                     sizeY: { $ifNull: ['$$machineInfo.sizeY', '0'] },
//                                     sizeZ: { $ifNull: ['$$machineInfo.sizeZ', '0'] }
//                                   }
//                                 }
//                               },
//                               // Legacy fields for backward compatibility
//                               machineName: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: { $ifNull: ['$$machineInfo.machineName', 'Machine Not Found'] }
//                                 }
//                               },
//                               machineTypeName: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: { $ifNull: ['$$machineInfo.machineTypeName', 'Type Not Found'] }
//                                 }
//                               },
//                               sizeX: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: { $ifNull: ['$$machineInfo.sizeX', '0'] }
//                                 }
//                               },
//                               sizeY: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: { $ifNull: ['$$machineInfo.sizeY', '0'] }
//                                 }
//                               },
//                               sizeZ: {
//                                 $let: {
//                                   vars: {
//                                     machineInfo: {
//                                       $arrayElemAt: [
//                                         {
//                                           $filter: {
//                                             input: { $ifNull: ['$allMachineDetails', []] },
//                                             as: 'machineDetail',
//                                             cond: { $eq: ['$$machineDetail._id', '$$machine.machineId'] }
//                                           }
//                                         },
//                                         0
//                                       ]
//                                     }
//                                   },
//                                   in: { $ifNull: ['$$machineInfo.sizeZ', '0'] }
//                                 }
//                               }
//                             }
//                           }
//                         },
//                         else: []
//                       }
//                     }
//                   }
//                 }
//               },
//               else: []
//             }
//           },
          
//           // Calculate progress metrics
//           totalSteps: { 
//             $size: { 
//               $cond: {
//                 if: { $isArray: '$steps' },
//                 then: '$steps',
//                 else: []
//               }
//             } 
//           },
//           completedSteps: {
//             $size: {
//               $filter: {
//                 input: { 
//                   $cond: {
//                     if: { $isArray: '$steps' },
//                     then: '$steps',
//                     else: []
//                   }
//                 },
//                 as: 'step',
//                 cond: {
//                   $cond: {
//                     if: { $and: [
//                       { $ne: ['$$step.machines', null] },
//                       { $ne: ['$$step.machines', []] },
//                       { $isArray: '$$step.machines' }
//                     ]},
//                     then: {
//                       $allElementsTrue: {
//                         $map: {
//                           input: '$$step.machines',
//                           as: 'machine',
//                           in: { $eq: ['$$machine.status', 'completed'] }
//                         }
//                       }
//                     },
//                     else: false
//                   }
//                 }
//               }
//             }
//           }
//         }
//       },
      
//       // Calculate progress percentage
//       {
//         $addFields: {
//           progressPercentage: {
//             $cond: [
//               { $gt: ['$totalSteps', 0] },
//               {
//                 $multiply: [
//                   { $divide: ['$completedSteps', '$totalSteps'] },
//                   100
//                 ]
//               },
//               0
//             ]
//           }
//         }
//       },
      
//       // Clean up temporary fields
//       {
//         $project: {
//           allMachineIds: 0,
//           allMachineDetails: 0,
//           stepDetails: 0,
//           mixMaterialDetails: 0
//         }
//       },
      
//       // Sort by priority and creation date
//       { 
//         $sort: { 
//           priority: -1,
//           createdAt: 1 
//         } 
//       },
      
//       // Additional filter: Only include orders where THIS specific machine has pending/in-progress status
//       {
//         $addFields: {
//           hasPendingMachine: {
//             $anyElementTrue: {
//               $map: {
//                 input: '$steps',
//                 as: 'step',
//                 in: {
//                   $anyElementTrue: {
//                     $map: {
//                       input: { $ifNull: ['$step.machines', []] },
//                       as: 'machine',
//                       in: {
//                         $and: [
//                           { $eq: ['$machine.machineId', machineObjectId] },
//                           { 
//                             $or: [
//                               { $eq: ['$machine.status', 'pending'] },
//                               { $eq: ['$machine.status', 'in-progress'] }
//                             ]
//                           }
//                         ]
//                       }
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       },
      
//       // Filter out orders where the machine is not pending/in-progress
//       {
//         $match: {
//           hasPendingMachine: true
//         }
//       },
      
//       // Remove the temporary field
//       {
//         $project: {
//           hasPendingMachine: 0
//         }
//       }
//     ];

//     console.log("🚀 Executing aggregation pipeline for machine pending orders...");
//     console.log("🔍 Machine ID:", machineObjectId);
//     console.log("📋 Filter criteria: orders with machine", machineObjectId, "in pending/in-progress status");

//     const startTime = Date.now();
//     const orders = await Order.aggregate(pipeline).allowDiskUse(true).exec();
//     const queryTime = Date.now() - startTime;

//     console.log(`⚡ Query executed in ${queryTime}ms`);
//     console.log(`📦 Found ${orders.length} pending orders for machine`);
    
//     // Debug: Show details of found orders
//     if (orders.length > 0) {
//       console.log("\n=== PENDING ORDERS DEBUG ===");
//       orders.forEach((order, index) => {
//         console.log(`\nOrder ${index + 1}:`, {
//           orderId: order.orderId,
//           overallStatus: order.overallStatus,
//           priority: order.priority,
//           customerName: order.customer?.companyName || order.customer?.firstName,
//           totalSteps: order.steps?.length || 0
//         });
        
//         // Show which steps have this machine
//         if (order.steps) {
//           order.steps.forEach((step, stepIndex) => {
//             const machinesInStep = step.machines?.filter(m => 
//               m.machineId && m.machineId.toString() === machineObjectId.toString()
//             ) || [];
            
//             if (machinesInStep.length > 0) {
//               console.log(`  Step ${stepIndex + 1} (${step.stepDetails?.stepName}):`, {
//                 machineCount: machinesInStep.length,
//                 statuses: machinesInStep.map(m => m.status)
//               });
//             }
//           });
//         }
//       });
//     } else {
//       console.log("\n⚠️ No pending orders found. Checking database...");
      
//       // Debug query to see all orders with this machine
//       const allOrdersWithMachine = await Order.find({
//         'steps.machines.machineId': machineObjectId
//       }).select('orderId overallStatus steps').lean();
      
//       console.log(`📊 Total orders containing this machine: ${allOrdersWithMachine.length}`);
      
//       if (allOrdersWithMachine.length > 0) {
//         console.log("Sample order statuses:");
//         allOrdersWithMachine.slice(0, 3).forEach(order => {
//           console.log(`  Order ${order.orderId}: ${order.overallStatus}`);
//           order.steps?.forEach((step, idx) => {
//             const machines = step.machines?.filter(m => 
//               m.machineId && m.machineId.toString() === machineObjectId.toString()
//             );
//             if (machines && machines.length > 0) {
//               console.log(`    Step ${idx + 1}: Machine status = ${machines.map(m => m.status).join(', ')}`);
//             }
//           });
//         });
//       }
//     }

//     // Calculate summary statistics
//     const summary = {
//       totalPendingOrders: orders.length,
//       urgentOrders: orders.filter(order => order.priority === 'urgent').length,
//       highPriorityOrders: orders.filter(order => order.priority === 'high').length,
//       normalPriorityOrders: orders.filter(order => order.priority === 'normal').length,
//       byStatus: {
//         pending: orders.filter(order => order.overallStatus === 'pending').length,
//         inProgress: orders.filter(order => order.overallStatus === 'in_progress').length,
//         waitForApproval: orders.filter(order => order.overallStatus === 'Wait for Approval').length
//       }
//     };

//     return {
//       statusCode: 200,
//       headers: {
//         'Content-Type': 'application/json',
//         'Cache-Control': 'private, max-age=300',
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
//         'Access-Control-Allow-Methods': 'POST,OPTIONS'
//       },
//       body: JSON.stringify({
//         success: true,
//         data: {
//           machine: {
//             id: machine._id,
//             name: machine.machineName,
//             type: machine.machineType
//           },
//           orders: orders,
//           summary: summary,
//           meta: {
//             queryTime,
//             timestamp: new Date().toISOString(),
//             machineId: machineId
//           }
//         }
//       })
//     };

//   } catch (error) {
//     console.error('❌ Error in machineAllPendingOrders:', error);
//     return {
//       statusCode: 500,
//       headers: {
//         'Content-Type': 'application/json',
//         'Access-Control-Allow-Origin': '*'
//       },
//       body: JSON.stringify({ 
//         success: false,
//         message: 'Internal server error',
//         error: error.message 
//       })
//     };
//   }
// };

module.exports.MachineStartOrder = async (event) => {
  await connect();
  
  try {
    // 1. Verify operator authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);
    
    if (!operatorData || operatorData.role !== 'operator') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ 
          success: false,
          message: 'Unauthorized' 
        }) 
      };
    }

    // Get request data
    const { orderId, machineId } = JSON.parse(event.body || "{}");
    
    if (!orderId || !machineId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false,
          message: 'Order ID and Machine ID are required' 
        }) 
      };
    }

    // 2. Verify operator exists
    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Operator not found' 
        }) 
      };
    }

    // 3. Verify machine exists
    const machine = await Machine.findById(machineId).populate('tableConfig');
    if (!machine) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Machine not found' 
        }) 
      };
    }

    // Check if machine has table configuration
    if (!machine.tableConfig || !machine.tableConfig.columns || machine.tableConfig.columns.length === 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false,
          message: 'Machine table configuration not found or incomplete' 
        }) 
      };
    }

    // 4. Find and validate the order
    const order = await Order.findOne({ orderId })
      .populate('customerId', 'name email')
      .populate('materialId', 'materialName materialMol')
      .populate({
        path: 'steps.machines.machineId',
        select: 'machineName machineType'
      });

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: `Order ${orderId} not found`
        })
      };
    }

    // 5. Find the specific machine in the order steps
    let targetMachine = null;
    let targetStep = null;
    let stepIndex = -1;
    let machineIndex = -1;

    for (let i = 0; i < order.steps.length; i++) {
      const step = order.steps[i];
      
      for (let j = 0; j < step.machines.length; j++) {
        const machineProgress = step.machines[j];
        
        if (machineProgress.machineId._id.toString() === machineId.toString()) {
          targetMachine = machineProgress;
          targetStep = step;
          stepIndex = i;
          machineIndex = j;
          break;
        }
      }
      
      if (targetMachine) break;
    }

    if (!targetMachine) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Machine ${machine.machineName} not found in order ${orderId}`
        })
      };
    }

    // 6. Validate if machine can be started
    // Check if operator has permission
    const canOperate = !targetMachine.operatorId || 
                      targetMachine.operatorId.toString() === operator._id.toString() ||
                      targetMachine.status === 'pending';

    if (!canOperate) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          message: `Machine ${machine.machineName} is assigned to another operator`
        })
      };
    }

    // Check if machine is already completed
    if (targetMachine.status === 'completed') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Machine ${machine.machineName} is already completed for this order`
        })
      };
    }

    // Check if previous steps/machines are completed
    const canStart = checkCanStartMachine(order, stepIndex, targetMachine);
    if (!canStart) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Cannot start this machine. Previous steps or machines are not completed yet.'
        })
      };
    }

    // 7. Update machine and order status
    const now = new Date();

    // Update machine status to in-progress
    order.steps[stepIndex].machines[machineIndex].status = 'in-progress';
    order.steps[stepIndex].machines[machineIndex].operatorId = operator._id;
    order.steps[stepIndex].machines[machineIndex].operatorName = operator.name;
    order.steps[stepIndex].machines[machineIndex].startedAt = now;

    // Update step status if this is the first machine in step to start
    if (targetStep.stepStatus === 'pending') {
      order.steps[stepIndex].stepStatus = 'in-progress';
      order.steps[stepIndex].stepStartedAt = now;
    }

    // Update overall order status
    if (order.overallStatus === 'pending' || order.overallStatus === 'Wait for Approval') {
      order.overallStatus = 'in_progress';
      if (!order.actualStartDate) {
        order.actualStartDate = now;
      }
    }

    // Save order changes
    await order.save();

    // 8. Initialize or get machine table data
    let machineTableData = await MachineTableData.findOne({ 
      machineId: machineId,
      orderId: order._id 
    });

    if (!machineTableData) {
      // Initialize new table data
      machineTableData = await MachineTableData.initializeForOrder(
        machineId, 
        order._id, 
        operator.name
      );
    } else {
      // Update existing table with current operator
      machineTableData.currentOperator = operator.name;
      machineTableData.status = 'active';
      machineTableData.shiftInfo.startTime = now;
      await machineTableData.save();
    }

    // 9. Prepare machine table configuration for frontend
    const tableConfig = {
      machineId: machine._id,
      machineName: machine.machineName,
      columns: machine.tableConfig.columns.map(col => ({
        name: col.name,
        type: col.type,
        required: col.required || false,
        defaultValue: col.defaultValue || null,
        validation: col.validation || null,
        unit: col.unit || null,
        description: col.description || null
      })),
      formulas: Object.fromEntries(machine.tableConfig.formulas || new Map()),
      settings: machine.tableConfig.settings || {},
      initialData: machineTableData.getFormattedData()
    };

    // 10. Get previous machine data for context
    const previousMachineData = [];
    for (let i = 0; i < stepIndex; i++) {
      const prevStep = order.steps[i];
      
      for (const prevMachine of prevStep.machines) {
        if (prevMachine.status === 'completed') {
          const prevTableData = await MachineTableData.findById(prevMachine.machineTableDataId)
            .select('totalCalculations rowData.length status');

          previousMachineData.push({
            stepIndex: i,
            stepName: prevStep.stepName,
            machineName: prevMachine.machineId.machineName,
            operatorName: prevMachine.operatorName,
            completedAt: prevMachine.completedAt,
            calculatedOutput: prevMachine.calculatedOutput,
            tableData: prevTableData ? {
              totalCalculations: prevTableData.totalCalculations,
              totalRows: prevTableData.rowData?.length || 0,
              status: prevTableData.status
            } : null
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: `Order ${orderId} started on machine ${machine.machineName}`,
        data: {
          order: {
            orderId: order.orderId,
            customerName: order.customerName,
            materialWeight: order.materialWeight,
            dimensions: {
              width: order.Width,
              height: order.Height,
              thickness: order.Thickness
            },
            specifications: {
              sealingType: order.SealingType,
              bottomGusset: order.BottomGusset,
              flap: order.Flap,
              airHole: order.AirHole,
              printing: order.Printing,
              colors: order.colors
            },
            priority: order.priority,
            overallStatus: order.overallStatus,
            realTimeData: order.realTimeData
          },
          machine: {
            id: machine._id,
            name: machine.machineName,
            type: machine.machineType,
            status: 'in-progress',
            operator: {
              id: operator._id,
              name: operator.name
            },
            startedAt: now
          },
          currentStep: {
            stepIndex: stepIndex,
            stepName: targetStep.stepName,
            stepStatus: targetStep.stepStatus,
            targetOutput: targetMachine.targetOutput
          },
          // TABLE CONFIGURATION AND DATA
          tableConfig: tableConfig,
          previousMachineData: previousMachineData,
          
          // Instructions for operator
          instructions: {
            message: "Order started successfully! You can now enter production data in the table.",
            nextActions: [
              "Enter material data in the table rows",
              "System will automatically calculate formulas",
              "Monitor quality parameters",
              "Complete when target output is achieved"
            ]
          }
        }
      })
    };

  } catch (error) {
    console.error('Error in MachineStartOrder:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};



module.exports.MachineOrderSave = async (event) => {
  await connect();
  
  try {
    // 1. Verify operator authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);
    
    if (!operatorData || operatorData.role !== 'operator') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ 
          success: false,
          message: 'Unauthorized' 
        }) 
      };
    }

    // Get request data
    const { 
      orderId, 
      machineId, 
      tableData, 
      completeOrder = false,
      qualityCheck = {},
      notes = ""
    } = JSON.parse(event.body || "{}");
    
    if (!orderId || !machineId || !tableData) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false,
          message: 'Order ID, Machine ID and table data are required' 
        }) 
      };
    }

    // 2. Verify operator exists
    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Operator not found' 
        }) 
      };
    }

    // 3. Verify machine exists
    const machine = await Machine.findById(machineId);
    if (!machine) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Machine not found' 
        }) 
      };
    }

    // 4. Find and validate the order
    const order = await Order.findOne({ orderId })
      .populate('customerId', 'name email')
      .populate({
        path: 'steps.machines.machineId',
        select: 'machineName machineType'
      });

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: `Order ${orderId} not found`
        })
      };
    }

    // 5. Find the specific machine in the order steps
    let targetMachine = null;
    let targetStep = null;
    let stepIndex = -1;
    let machineIndex = -1;

    for (let i = 0; i < order.steps.length; i++) {
      const step = order.steps[i];
      
      for (let j = 0; j < step.machines.length; j++) {
        const machineProgress = step.machines[j];
        
        if (machineProgress.machineId._id.toString() === machineId.toString()) {
          targetMachine = machineProgress;
          targetStep = step;
          stepIndex = i;
          machineIndex = j;
          break;
        }
      }
      
      if (targetMachine) break;
    }

    if (!targetMachine) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Machine ${machine.machineName} not found in order ${orderId}`
        })
      };
    }

    // 6. Validate operator permission
    if (targetMachine.operatorId?.toString() !== operator._id.toString()) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          message: 'This machine is not assigned to you'
        })
      };
    }

    // Check if machine is in correct status
    if (targetMachine.status !== 'in-progress') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Cannot save. Machine status is '${targetMachine.status}', expected 'in-progress'`
        })
      };
    }

    // 7. Get or create machine table data
    let machineTableData = await MachineTableData.findOne({ 
      machineId: machineId,
      orderId: order._id 
    });

    if (!machineTableData) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Machine table data not found. Please start the order first.'
        })
      };
    }

    // 8. Save table data
    const savedRows = [];
    
    // Process each row in tableData
    for (const rowData of tableData) {
      if (rowData.action === 'add') {
        // Add new row
        const newRow = await machineTableData.addRowWithCalculation(
          rowData.data, 
          operator.name
        );
        savedRows.push(newRow);
        
      } else if (rowData.action === 'update' && rowData.rowId) {
        // Update existing row
        const updatedRow = await machineTableData.updateRow(
          rowData.rowId,
          rowData.data,
          operator.name
        );
        savedRows.push(updatedRow);
        
      } else if (rowData.action === 'delete' && rowData.rowId) {
        // Delete row
        await machineTableData.deleteRow(rowData.rowId);
      }
    }

    // 9. Add notes if provided
    if (notes) {
      await machineTableData.addNote(notes, operator.name);
    }

    // 10. If completing the order
    const now = new Date();
    
    if (completeOrder) {
      // Validate minimum data requirements
      if (machineTableData.rowData.length === 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: 'Cannot complete order without production data'
          })
        };
      }

      // Check if target output is achieved (optional validation)
      const targetOutput = targetMachine.targetOutput;
      const actualOutput = machineTableData.totalCalculations;
      
      let qualityStatus = 'passed';
      const qualityNotes = [];
      
      // Quality checks
      if (targetOutput.expectedWeight && actualOutput.totalNetWeight < targetOutput.expectedWeight * 0.9) {
        qualityStatus = 'review';
        qualityNotes.push(`Net weight ${actualOutput.totalNetWeight}kg below expected ${targetOutput.expectedWeight}kg`);
      }
      
      if (targetOutput.expectedEfficiency && actualOutput.overallEfficiency < targetOutput.expectedEfficiency) {
        qualityStatus = 'review';
        qualityNotes.push(`Efficiency ${actualOutput.overallEfficiency}% below expected ${targetOutput.expectedEfficiency}%`);
      }
      
      if (targetOutput.maxWastage && actualOutput.totalWastage > targetOutput.maxWastage) {
        qualityStatus = 'review';
        qualityNotes.push(`Wastage ${actualOutput.totalWastage}kg exceeds maximum ${targetOutput.maxWastage}kg`);
      }

      // Apply manual quality check if provided
      if (qualityCheck.status) {
        qualityStatus = qualityCheck.status;
        if (qualityCheck.notes) {
          qualityNotes.push(...qualityCheck.notes);
        }
      }

      // 11. Update machine status to completed
      order.steps[stepIndex].machines[machineIndex].status = 'completed';
      order.steps[stepIndex].machines[machineIndex].completedAt = now;
      order.steps[stepIndex].machines[machineIndex].calculatedOutput = {
        netWeight: actualOutput.totalNetWeight,
        wastageWeight: actualOutput.totalWastage,
        efficiency: actualOutput.overallEfficiency,
        totalCost: actualOutput.totalCost,
        rowsProcessed: actualOutput.totalRows,
        lastUpdated: now
      };
      order.steps[stepIndex].machines[machineIndex].qualityStatus = qualityStatus;
      order.steps[stepIndex].machines[machineIndex].qualityNotes = qualityNotes;
      order.steps[stepIndex].machines[machineIndex].machineTableDataId = machineTableData._id;

      // 12. Update machine table status
      machineTableData.status = 'completed';
      machineTableData.shiftInfo.endTime = now;
      await machineTableData.save();

      // 13. Check if step is completed
      const allMachinesInStepCompleted = targetStep.machines.every(m => m.status === 'completed');
      
      if (allMachinesInStepCompleted) {
        order.steps[stepIndex].stepStatus = 'completed';
        order.steps[stepIndex].stepCompletedAt = now;
        
        // Start next step if available
        if (stepIndex + 1 < order.steps.length) {
          order.currentStepIndex = stepIndex + 1;
          order.steps[stepIndex + 1].stepStatus = 'pending';
        }
      }

      // 14. Check if entire order is completed
      const allStepsCompleted = order.steps.every(step => step.stepStatus === 'completed');
      
      if (allStepsCompleted) {
        order.overallStatus = 'completed';
        order.actualEndDate = now;
      }

      // 15. Update order with real-time data
      await order.updateRealTimeData();
    }

    // Save order changes
    await order.save();

    // 16. Prepare response
    const response = {
      success: true,
      message: completeOrder ? 
        `Machine ${machine.machineName} completed for order ${orderId}` :
        `Data saved for machine ${machine.machineName} on order ${orderId}`,
      data: {
        order: {
          orderId: order.orderId,
          customerName: order.customerName,
          overallStatus: order.overallStatus,
          currentStepIndex: order.currentStepIndex,
          completionPercentage: order.completionPercentage,
          realTimeData: order.realTimeData
        },
        machine: {
          id: machine._id,
          name: machine.machineName,
          status: completeOrder ? 'completed' : 'in-progress',
          operator: {
            id: operator._id,
            name: operator.name
          },
          completedAt: completeOrder ? now : null
        },
        tableData: {
          tableId: machineTableData._id,
          totalCalculations: machineTableData.totalCalculations,
          totalRows: machineTableData.rowData.length,
          status: machineTableData.status,
          lastUpdated: machineTableData.lastCalculatedAt,
          savedRows: savedRows.length
        },
        step: {
          stepIndex: stepIndex,
          stepName: targetStep.stepName,
          stepStatus: targetStep.stepStatus,
          allMachinesCompleted: targetStep.machines.every(m => m.status === 'completed')
        },
        qualityInfo: completeOrder ? {
          status: order.steps[stepIndex].machines[machineIndex].qualityStatus,
          notes: order.steps[stepIndex].machines[machineIndex].qualityNotes
        } : null,
        nextActions: getNextActions(order, stepIndex, completeOrder)
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error in MachineOrderSave:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};




module.exports.MachineOrderStop = async (event) => {
  await connect();
  
  try {
    // 1. Verify operator authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const operatorData = verifyToken(authHeader);
    
    if (!operatorData || operatorData.role !== 'operator') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ 
          success: false,
          message: 'Unauthorized' 
        }) 
      };
    }

    // Get request data
    const { 
      orderId, 
      machineId, 
      tableData = [],
      stopReason,
      stopType = 'pause', // 'pause', 'stop', 'error', 'maintenance'
      notes = "",
      plannedResumeTime = null
    } = JSON.parse(event.body || "{}");
    
    if (!orderId || !machineId || !stopReason) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false,
          message: 'Order ID, Machine ID and stop reason are required' 
        }) 
      };
    }

    // Validate stop type
    const validStopTypes = ['pause', 'stop', 'error', 'maintenance'];
    if (!validStopTypes.includes(stopType)) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid stop type. Use: pause, stop, error, or maintenance' 
        }) 
      };
    }

    // 2. Verify operator exists
    const operator = await Operator.findById(operatorData._id);
    if (!operator) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Operator not found' 
        }) 
      };
    }

    // 3. Verify machine exists
    const machine = await Machine.findById(machineId);
    if (!machine) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          success: false,
          message: 'Machine not found' 
        }) 
      };
    }

    // 4. Find and validate the order
    const order = await Order.findOne({ orderId })
      .populate('customerId', 'name email')
      .populate({
        path: 'steps.machines.machineId',
        select: 'machineName machineType'
      });

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: `Order ${orderId} not found`
        })
      };
    }

    // 5. Find the specific machine in the order steps
    let targetMachine = null;
    let targetStep = null;
    let stepIndex = -1;
    let machineIndex = -1;

    for (let i = 0; i < order.steps.length; i++) {
      const step = order.steps[i];
      
      for (let j = 0; j < step.machines.length; j++) {
        const machineProgress = step.machines[j];
        
        if (machineProgress.machineId._id.toString() === machineId.toString()) {
          targetMachine = machineProgress;
          targetStep = step;
          stepIndex = i;
          machineIndex = j;
          break;
        }
      }
      
      if (targetMachine) break;
    }

    if (!targetMachine) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Machine ${machine.machineName} not found in order ${orderId}`
        })
      };
    }

    // 6. Validate operator permission
    if (targetMachine.operatorId?.toString() !== operator._id.toString()) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          message: 'This machine is not assigned to you'
        })
      };
    }

    // Check if machine is in correct status to stop
    if (!['in-progress', 'paused'].includes(targetMachine.status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: `Cannot stop. Machine status is '${targetMachine.status}'. Only 'in-progress' or 'paused' machines can be stopped.`
        })
      };
    }

    // 7. Get machine table data
    let machineTableData = await MachineTableData.findOne({ 
      machineId: machineId,
      orderId: order._id 
    });

    if (!machineTableData) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'Machine table data not found'
        })
      };
    }

    // 8. Save any pending table data first
    const savedRows = [];
    
    if (tableData.length > 0) {
      for (const rowData of tableData) {
        try {
          if (rowData.action === 'add') {
            const newRow = await machineTableData.addRowWithCalculation(
              rowData.data, 
              operator.name
            );
            savedRows.push(newRow);
            
          } else if (rowData.action === 'update' && rowData.rowId) {
            const updatedRow = await machineTableData.updateRow(
              rowData.rowId,
              rowData.data,
              operator.name
            );
            savedRows.push(updatedRow);
            
          } else if (rowData.action === 'delete' && rowData.rowId) {
            await machineTableData.deleteRow(rowData.rowId);
          }
        } catch (rowError) {
          console.error('Error saving row data:', rowError);
          // Continue with other rows
        }
      }
    }

    // 9. Determine new status based on stop type
    let newMachineStatus;
    let newTableStatus;
    
    switch (stopType) {
      case 'pause':
        newMachineStatus = 'paused';
        newTableStatus = 'paused';
        break;
      case 'stop':
        newMachineStatus = 'pending'; // Reset to pending for reassignment
        newTableStatus = 'paused';
        break;
      case 'error':
        newMachineStatus = 'error';
        newTableStatus = 'paused';
        break;
      case 'maintenance':
        newMachineStatus = 'paused';
        newTableStatus = 'paused';
        break;
      default:
        newMachineStatus = 'paused';
        newTableStatus = 'paused';
    }

    // 10. Update machine status and add stop information
    const now = new Date();
    
    order.steps[stepIndex].machines[machineIndex].status = newMachineStatus;
    order.steps[stepIndex].machines[machineIndex].reason = stopReason;
    order.steps[stepIndex].machines[machineIndex].note = notes;
    
    // For 'stop' type, clear operator assignment to allow reassignment
    if (stopType === 'stop') {
      order.steps[stepIndex].machines[machineIndex].operatorId = null;
      order.steps[stepIndex].machines[machineIndex].operatorName = null;
    }

    // Update calculated output with current progress
    order.steps[stepIndex].machines[machineIndex].calculatedOutput = {
      netWeight: machineTableData.totalCalculations.totalNetWeight,
      wastageWeight: machineTableData.totalCalculations.totalWastage,
      efficiency: machineTableData.totalCalculations.overallEfficiency,
      totalCost: machineTableData.totalCalculations.totalCost,
      rowsProcessed: machineTableData.totalCalculations.totalRows,
      lastUpdated: now,
      status: 'partial' // Indicate this is partial/incomplete data
    };

    // 11. Update machine table data
    machineTableData.status = newTableStatus;
    machineTableData.shiftInfo.endTime = now;
    
    // Add stop note
    const stopNote = `${stopType.toUpperCase()}: ${stopReason}${notes ? ` - ${notes}` : ''}`;
    await machineTableData.addNote(stopNote, operator.name);

    // If planned resume time provided
    if (plannedResumeTime) {
      await machineTableData.addNote(`Planned resume: ${plannedResumeTime}`, operator.name);
    }

    await machineTableData.save();

    // 12. Update step status if needed
    // If all machines in step are stopped/paused/completed, pause the step
    const activeMachinesInStep = targetStep.machines.filter(m => m.status === 'in-progress');
    
    if (activeMachinesInStep.length === 0 && targetStep.stepStatus === 'in-progress') {
      const completedMachines = targetStep.machines.filter(m => m.status === 'completed');
      
      if (completedMachines.length === targetStep.machines.length) {
        // All machines completed
        order.steps[stepIndex].stepStatus = 'completed';
        order.steps[stepIndex].stepCompletedAt = now;
      } else {
        // Some machines stopped/paused
        order.steps[stepIndex].stepStatus = 'blocked';
      }
    }

    // 13. Update order real-time data
    await order.updateRealTimeData();
    
    // Save order changes
    await order.save();

    // 14. Prepare response
    const response = {
      success: true,
      message: getStopMessage(stopType, machine.machineName, stopReason),
      data: {
        order: {
          orderId: order.orderId,
          customerName: order.customerName,
          overallStatus: order.overallStatus,
          currentStepIndex: order.currentStepIndex,
          completionPercentage: order.completionPercentage,
          realTimeData: order.realTimeData
        },
        machine: {
          id: machine._id,
          name: machine.machineName,
          previousStatus: 'in-progress',
          currentStatus: newMachineStatus,
          operator: stopType === 'stop' ? null : {
            id: operator._id,
            name: operator.name
          },
          stoppedAt: now,
          stopReason: stopReason,
          stopType: stopType,
          plannedResumeTime: plannedResumeTime
        },
        tableData: {
          tableId: machineTableData._id,
          totalCalculations: machineTableData.totalCalculations,
          totalRows: machineTableData.rowData.length,
          status: machineTableData.status,
          lastUpdated: machineTableData.lastCalculatedAt,
          savedRows: savedRows.length,
          progressSaved: true
        },
        step: {
          stepIndex: stepIndex,
          stepName: targetStep.stepName,
          stepStatus: targetStep.stepStatus,
          activeMachines: targetStep.machines.filter(m => m.status === 'in-progress').length,
          pausedMachines: targetStep.machines.filter(m => ['paused', 'error'].includes(m.status)).length,
          completedMachines: targetStep.machines.filter(m => m.status === 'completed').length
        },
        nextActions: getStopNextActions(stopType, newMachineStatus, order, stepIndex)
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error in MachineOrderStop:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false,
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};

// ============================================================================
module.exports.cancelOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== cancelOrder Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, cancelReason, cancelledBy } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID is required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Cannot cancel if already completed
    if (order.overallStatus === 'completed') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Cannot cancel a completed order' })
      };
    }

    const previousStatus = order.overallStatus;
    order.overallStatus = 'cancelled';

    // Add note
    order.notes.push({
      message: `❌ CANCELLED: ${cancelReason || 'No reason provided'}`,
      createdBy: cancelledBy || 'System',
      noteType: 'production',
      createdAt: new Date()
    });

    await order.save();

    console.log(`❌ Order ${order.orderId} cancelled`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} cancelled`,
        data: {
          orderId: order.orderId,
          previousStatus: previousStatus,
          currentStatus: 'cancelled',
          cancelReason: cancelReason,
          cancelledAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in cancelOrder:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// 10. DISPATCH ORDER - Change from "completed" to "dispatched"
// ============================================================================
module.exports.dispatchOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== dispatchOrder Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, shippingMethod, trackingNumber, dispatchedBy } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID is required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Check if completed
    if (order.overallStatus !== 'completed') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          message: `Order status is '${order.overallStatus}'. Only 'completed' orders can be dispatched.` 
        })
      };
    }

    // Update delivery info
    order.delivery = {
      ...order.delivery,
      actualDate: new Date(),
      shippingMethod: shippingMethod || order.delivery?.shippingMethod,
      trackingNumber: trackingNumber || order.delivery?.trackingNumber,
      deliveryStatus: 'shipped'
    };

    order.overallStatus = 'dispatched';

    // Add note
    order.notes.push({
      message: `📦 DISPATCHED: ${shippingMethod || 'Standard shipping'}${trackingNumber ? ` - Tracking: ${trackingNumber}` : ''}`,
      createdBy: dispatchedBy || 'System',
      noteType: 'delivery',
      createdAt: new Date()
    });

    await order.save();

    console.log(`📦 Order ${order.orderId} dispatched`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} dispatched`,
        data: {
          orderId: order.orderId,
          previousStatus: 'completed',
          currentStatus: 'dispatched',
          delivery: {
            shippingMethod: shippingMethod,
            trackingNumber: trackingNumber,
            dispatchedAt: order.delivery.actualDate
          }
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in dispatchOrder:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};


// ============================================================================
// 2. APPROVE ORDER - Change from "Wait for Approval" to "pending"
// ============================================================================
module.exports.approveOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== approveOrder Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, approvedBy, approvalNotes } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID is required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Check current status
    if (order.overallStatus !== 'Wait for Approval') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          message: `Order status is '${order.overallStatus}'. Only 'Wait for Approval' orders can be approved.` 
        })
      };
    }

    // Update order status
    order.overallStatus = 'pending';
    
    // Add approval note
    if (approvalNotes) {
      order.notes.push({
        message: `✅ APPROVED: ${approvalNotes}`,
        createdBy: approvedBy || 'System',
        noteType: 'production',
        createdAt: new Date()
      });
    }

    await order.save();

    console.log(`✅ Order ${order.orderId} approved`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} approved successfully`,
        data: {
          orderId: order.orderId,
          previousStatus: 'Wait for Approval',
          currentStatus: 'pending',
          approvedAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in approveOrder:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};



// ============================================================================
// 4. COMPLETE MACHINE - Auto-advance to next machine or step
// ============================================================================
module.exports.completeOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== completeMachine Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, stepIndex, machineId, operatorId, completionNotes } = body;
    
    if (!orderId || stepIndex === undefined || !machineId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID, step index, and machine ID are required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Validate step index
    if (stepIndex < 0 || stepIndex >= order.steps.length) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Invalid step index' })
      };
    }

    const step = order.steps[stepIndex];
    const machineIndex = step.machines.findIndex(m => m.machineId.toString() === machineId.toString());

    if (machineIndex === -1) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Machine not found in step' })
      };
    }

    const now = new Date();
    const machine = step.machines[machineIndex];
    
    // Check if already completed
    if (machine.status === 'completed') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Machine already completed' })
      };
    }

    // Mark machine as completed
    machine.status = 'completed';
    machine.completedAt = now;

    // Add note
    if (completionNotes) {
      order.notes.push({
        message: `✅ MACHINE COMPLETED (Step ${stepIndex + 1}, Machine ${machineIndex + 1}): ${completionNotes}`,
        createdBy: operatorId || 'System',
        noteType: 'production',
        createdAt: now
      });
    }

    // Check if there's a next machine in the same step
    const nextMachineInStep = step.machines[machineIndex + 1];
    
    if (nextMachineInStep && nextMachineInStep.status === 'none') {
      // Auto-advance next machine to pending
      nextMachineInStep.status = 'pending';
      
      console.log(`⏭️ Next machine in step advanced to pending`);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          message: `Machine completed. Next machine in step is ready!`,
          data: {
            orderId: order.orderId,
            currentMachine: {
              index: machineIndex,
              status: 'completed',
              completedAt: now
            },
            nextMachine: {
              index: machineIndex + 1,
              status: 'pending',
              ready: true
            },
            stepIndex: stepIndex,
            machinesInStep: step.machines.length
          }
        })
      };
    }

    // Check if all machines in step are completed
    const allMachinesCompleted = step.machines.every(m => m.status === 'completed');
    
    if (allMachinesCompleted) {
      step.stepStatus = 'completed';
      step.stepCompletedAt = now;
      
      console.log(`✅ Step ${stepIndex + 1} completed`);

      // Check if there's a next step
      if (stepIndex + 1 < order.steps.length) {
        const nextStep = order.steps[stepIndex + 1];
        nextStep.stepStatus = 'in-progress';
        nextStep.stepStartedAt = now;
        order.currentStepIndex = stepIndex + 1;
        
        // Auto-set first machine of next step to pending
        if (nextStep.machines.length > 0 && nextStep.machines[0].status === 'none') {
          nextStep.machines[0].status = 'pending';
        }

        await order.save();

        console.log(`⏭️ Step ${stepIndex + 2} started automatically`);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: true,
            message: `Step ${stepIndex + 1} completed! Next step started.`,
            data: {
              orderId: order.orderId,
              completedStep: {
                index: stepIndex,
                status: 'completed'
              },
              nextStep: {
                index: stepIndex + 1,
                status: 'in-progress',
                stepName: nextStep.stepDetails?.stepName || 'Next Step'
              },
              progressPercentage: order.completionPercentage
            }
          })
        };
      }

      // All steps completed
      order.overallStatus = 'completed';
      order.actualEndDate = now;

      await order.save();

      console.log(`🎉 Order ${order.orderId} COMPLETED!`);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          message: `🎉 ORDER COMPLETED! All steps finished.`,
          data: {
            orderId: order.orderId,
            previousStatus: 'in_progress',
            currentStatus: 'completed',
            completedAt: order.actualEndDate,
            totalSteps: order.steps.length,
            progressPercentage: 100
          }
        })
      };
    }

    // Still have machines in current step
    await order.save();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Machine completed. More machines in step.`,
        data: {
          orderId: order.orderId,
          currentMachine: {
            index: machineIndex,
            status: 'completed'
          },
          stepIndex: stepIndex,
          machinesCompleted: step.machines.filter(m => m.status === 'completed').length,
          machinesRemaining: step.machines.filter(m => ['pending', 'in-progress', 'none'].includes(m.status)).length
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in completeMachine:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// 5. PAUSE ORDER - Change status to paused
// ============================================================================
module.exports.pauseOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== pauseOrder Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, pauseReason, pauseBy } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID is required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Check if can be paused
    if (order.overallStatus === 'completed' || order.overallStatus === 'cancelled') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          message: `Cannot pause order with status '${order.overallStatus}'` 
        })
      };
    }

    // Pause all in-progress machines
    order.steps.forEach(step => {
      step.machines.forEach(machine => {
        if (machine.status === 'in-progress') {
          machine.status = 'paused';
        }
      });
      if (step.stepStatus === 'in-progress') {
        step.stepStatus = 'paused';
      }
    });

    const previousStatus = order.overallStatus;
    order.overallStatus = 'paused';

    // Add note
    order.notes.push({
      message: `⏸️ PAUSED: ${pauseReason || 'No reason provided'}`,
      createdBy: pauseBy || 'System',
      noteType: 'production',
      createdAt: new Date()
    });

    await order.save();

    console.log(`⏸️ Order ${order.orderId} paused`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} paused`,
        data: {
          orderId: order.orderId,
          previousStatus: previousStatus,
          currentStatus: 'paused',
          pauseReason: pauseReason,
          pausedAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in pauseOrder:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// 6. RESUME ORDER - Change from "paused" back to "in_progress"
// ============================================================================
module.exports.resumeOrderMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== resumeOrder Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, resumeBy, resumeNotes } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID is required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    // Check if paused
    if (order.overallStatus !== 'paused') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          message: `Order status is '${order.overallStatus}'. Only 'paused' orders can be resumed.` 
        })
      };
    }

    // Resume all paused machines to in-progress
    order.steps.forEach(step => {
      step.machines.forEach(machine => {
        if (machine.status === 'paused') {
          machine.status = 'in-progress';
        }
      });
      if (step.stepStatus === 'paused') {
        step.stepStatus = 'in-progress';
      }
    });

    order.overallStatus = 'in_progress';

    // Add note
    order.notes.push({
      message: `▶️ RESUMED: ${resumeNotes || 'No notes'}`,
      createdBy: resumeBy || 'System',
      noteType: 'production',
      createdAt: new Date()
    });

    await order.save();

    console.log(`▶️ Order ${order.orderId} resumed`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} resumed`,
        data: {
          orderId: order.orderId,
          previousStatus: 'paused',
          currentStatus: 'in_progress',
          resumedAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in resumeOrder:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};

// ============================================================================
// 7. BLOCK STEP - Mark step as blocked (issues/problems)
// ============================================================================
module.exports.blockStepMachine = async (event) => {
  await connect();
  
  try {
    console.log("=== blockStep Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId, stepIndex, blockReason, blockedBy } = body;
    
    if (!orderId || stepIndex === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order ID and step index are required' })
      };
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Order not found' })
      };
    }

    if (stepIndex < 0 || stepIndex >= order.steps.length) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, message: 'Invalid step index' })
      };
    }

    const step = order.steps[stepIndex];
    step.stepStatus = 'blocked';

    // Add note
    order.notes.push({
      message: `🚫 STEP BLOCKED (Step ${stepIndex + 1}): ${blockReason || 'No reason provided'}`,
      createdBy: blockedBy || 'System',
      noteType: 'production',
      createdAt: new Date()
    });

    await order.save();

    console.log(`🚫 Step ${stepIndex + 1} blocked`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        message: `Step ${stepIndex + 1} blocked`,
        data: {
          orderId: order.orderId,
          stepIndex: stepIndex,
          stepStatus: 'blocked',
          blockReason: blockReason,
          blockedAt: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in blockStep:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: 'Internal server error', error: error.message })
    };
  }
};


module.exports.getOrderStatus = async (event) => {
  await connect();
  
  try {
    console.log("=== getOrderStatus Function Started ===");
    
    const body = JSON.parse(event.body || "{}");
    const { orderId } = body;
    
    if (!orderId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Order ID is required'
        })
      };
    }

    const order = await Order.findById(orderId)
      .populate('customerId', 'companyName firstName lastName email phone1')
      .populate('materialId', 'materialName materialType')
      .populate('branchId', 'name code');

    if (!order) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'Order not found'
        })
      };
    }

    console.log(`✅ Order found: ${order.orderId}`);

    // Build detailed status
    const detailedStatus = {
      order: {
        _id: order._id,
        orderId: order.orderId,
        customer: order.customerId,
        material: order.materialId,
        branch: order.branchId,
        status: order.overallStatus,
        priority: order.priority,
        progressPercentage: order.completionPercentage,
        specifications: {
          weight: order.materialWeight,
          width: order.Width,
          height: order.Height,
          thickness: order.Thickness,
          sealingType: order.SealingType,
          printing: order.Printing,
          colors: order.colors || []
        },
        createdAt: order.createdAt,
        startedAt: order.actualStartDate,
        completedAt: order.actualEndDate,
        financials: {
          estimatedCost: order.financial?.estimatedCost || 0,
          actualCost: order.financial?.actualCost || 0,
          finalPrice: order.financial?.finalPrice || 0
        }
      },
      steps: order.steps.map((step, idx) => ({
        index: idx,
        stepId: step.stepId,
        stepName: step.stepDetails?.stepName || `Step ${idx + 1}`,
        status: step.stepStatus,
        startedAt: step.stepStartedAt,
        completedAt: step.stepCompletedAt,
        notes: step.stepNotes,
        machinesCount: step.machines.length,
        machines: step.machines.map((m, mIdx) => ({
          index: mIdx,
          machineId: m.machineId,
          machineName: m.machineName,
          status: m.status,
          operatorId: m.operatorId,
          operatorName: m.operatorName,
          startedAt: m.startedAt,
          completedAt: m.completedAt,
          note: m.note,
          reason: m.reason,
          qualityStatus: m.qualityStatus,
          calculatedOutput: m.calculatedOutput,
          targetOutput: m.targetOutput
        }))
      })),
      summary: {
        totalSteps: order.steps.length,
        completedSteps: order.steps.filter(s => s.stepStatus === 'completed').length,
        inProgressSteps: order.steps.filter(s => s.stepStatus === 'in-progress').length,
        blockedSteps: order.steps.filter(s => s.stepStatus === 'blocked').length,
        pausedSteps: order.steps.filter(s => s.stepStatus === 'paused').length,
        
        totalMachines: order.steps.reduce((sum, s) => sum + s.machines.length, 0),
        completedMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'completed').length, 0),
        inProgressMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'in-progress').length, 0),
        pendingMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'pending').length, 0),
        pausedMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'paused').length, 0),
        noneMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'none').length, 0),
        errorMachines: order.steps.reduce((sum, s) => sum + s.machines.filter(m => m.status === 'error').length, 0)
      },
      timeline: {
        created: order.createdAt,
        started: order.actualStartDate,
        completed: order.actualEndDate,
        durationMs: order.actualEndDate && order.actualStartDate 
          ? order.actualEndDate - order.actualStartDate 
          : null,
        remainingSteps: order.steps.length - (order.steps.filter(s => s.stepStatus === 'completed').length),
        currentStepIndex: order.currentStepIndex,
        currentStep: order.steps[order.currentStepIndex]?.stepName || 'Pending'
      },
      notes: order.notes.map(note => ({
        message: note.message,
        createdBy: note.createdBy,
        type: note.noteType,
        createdAt: note.createdAt
      })) || [],
      qualityControl: {
        inspectionRequired: order.qualityControl?.inspectionRequired || false,
        inspectionStatus: order.qualityControl?.inspectionStatus || 'pending',
        qualityScore: order.qualityControl?.qualityScore || 0,
        qualityNotes: order.qualityControl?.qualityNotes || [],
        defects: order.qualityControl?.defects || []
      },
      realTimeData: {
        totalNetWeight: order.realTimeData?.totalNetWeight || 0,
        totalWastage: order.realTimeData?.totalWastage || 0,
        overallEfficiency: order.realTimeData?.overallEfficiency || 0,
        totalCost: order.realTimeData?.totalCost || 0,
        activeMachines: order.realTimeData?.activeMachines || 0,
        completedMachines: order.realTimeData?.completedMachines || 0,
        lastUpdated: order.realTimeData?.lastUpdated
      }
    };

    console.log(`📊 Order status retrieved:`, {
      orderId: order.orderId,
      status: order.overallStatus,
      progress: order.completionPercentage,
      completedSteps: detailedStatus.summary.completedSteps,
      completedMachines: detailedStatus.summary.completedMachines
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        success: true,
        message: `Order ${order.orderId} status retrieved successfully`,
        data: detailedStatus,
        meta: {
          timestamp: new Date().toISOString(),
          orderId: order.orderId,
          status: order.overallStatus,
          progressPercentage: order.completionPercentage
        }
      })
    };

  } catch (error) {
    console.error('❌ Error in getOrderStatus:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};




function getStopMessage(stopType, machineName, reason) {
  const messages = {
    'pause': `Machine ${machineName} paused - ${reason}`,
    'stop': `Work stopped on machine ${machineName} - ${reason}. Machine available for reassignment.`,
    'error': `Machine ${machineName} stopped due to error - ${reason}`,
    'maintenance': `Machine ${machineName} stopped for maintenance - ${reason}`
  };
  
  return messages[stopType] || `Machine ${machineName} stopped - ${reason}`;
}


function getStopNextActions(stopType, machineStatus, order, stepIndex) {
  const actions = [];
  
  switch (stopType) {
    case 'pause':
      actions.push("Work paused - progress saved");
      actions.push("Resume work when ready");
      actions.push("Machine remains assigned to you");
      break;
      
    case 'stop':
      actions.push("Work stopped - progress saved");
      actions.push("Machine available for other operators");
      actions.push("Another operator can continue from current progress");
      break;
      
    case 'error':
      actions.push("Machine stopped due to error");
      actions.push("Contact maintenance team");
      actions.push("Resolve issue before resuming");
      break;
      
    case 'maintenance':
      actions.push("Machine stopped for maintenance");
      actions.push("Schedule maintenance work");
      actions.push("Resume after maintenance completion");
      break;
  }
  
  // Check step status
  const currentStep = order.steps[stepIndex];
  const activeMachines = currentStep.machines.filter(m => m.status === 'in-progress');
  
  if (activeMachines.length === 0) {
    actions.push("⚠️ No active machines in current step");
  } else {
    actions.push(`${activeMachines.length} other machines still active in step`);
  }
  
  return actions;
}
