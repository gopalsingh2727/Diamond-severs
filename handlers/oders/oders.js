const mongoose = require('mongoose');
const Order = require('../../models/oders/oders');
const Branch = require('../../models/branch/branch');
const Step = require('../../models/steps/step');
const Machine = require('../../models/Machine/machine');
const verifyToken = require('../../utiles/verifyToken');
const mongoConnect = require('../../config/mongodb/db'); // Renamed to avoid conflict
const Customer = require('../../models/Customer/customer');
const Material = require('../../models/Material/material');
const MaterialType = require('../../models/MaterialType/materialType');
const MachineType = require('../../models/MachineType/machineType'); 
const operator = require('../../models/MachineOperator/MachineOperator')


const jwt = require('jsonwebtoken'); // Added missing import

module.exports.createOrder = async (event) => {
  await mongoConnect(); 

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    console.log("User from token:", user);
    
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const data = JSON.parse(event.body);
    console.log("Received data:", data);

  
    const requiredFields = [
      'customerId', 
      'materialId', 
      'materialTypeId',
      'materialWeight', 
      'Width',
      'Height', 
      'Thickness',
      'steps', 
      'branchId',
      'product27InfinityId'
    ];

    // Validate required fields
    for (const field of requiredFields) {
      if (!data[field] && data[field] !== 0) { // Allow 0 as valid value
        return { 
          statusCode: 400, 
          body: JSON.stringify({ message: `${field} is required` }) 
        };
      }
    }

    // Validate ObjectIds for required fields
    const objectIdFields = ['customerId', 'materialId', 'materialTypeId', 'branchId'];
    for (const idField of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(data[idField])) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ message: `Invalid ${idField}` }) 
        };
      }
    }

    // Validate steps array
    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Steps must be a non-empty array' }) 
      };
    }

    // Validate branch exists
    const branch = await Branch.findById(data.branchId);
    if (!branch || !branch.code) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Branch not found or missing code' }) 
      };
    }

    // Validate customer exists
    const customer = await Customer.findById(data.customerId);
    if (!customer) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Customer not found' }) 
      };
    }

    // Validate material exists
    const material = await Material.findById(data.materialId);
    if (!material) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Material not found' }) 
      };
    }

    // Validate material type exists
    const materialType = await MaterialType.findById(data.materialTypeId);
    if (!materialType) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Material type not found' }) 
      };
    }

    // Process and validate mixing materials if provided
    let validatedMixMaterials = [];
    if (data.mixMaterial && Array.isArray(data.mixMaterial) && data.mixMaterial.length > 0) {
      for (let i = 0; i < data.mixMaterial.length; i++) {
        const mixMat = data.mixMaterial[i];
        
        if (!mixMat.materialId || !mongoose.Types.ObjectId.isValid(mixMat.materialId)) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: `Invalid materialId in mixMaterial at index ${i}` })
          };
        }

        // Validate mix material exists
        const mixMaterial = await Material.findById(mixMat.materialId);
        if (!mixMaterial) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: `Mix material not found at index ${i}` })
          };
        }

        validatedMixMaterials.push({
          materialId: mixMat.materialId,
          materialName: mixMat.materialName || mixMaterial.name,
          materialType: mixMat.materialType || mixMaterial.type,
          materialWeight: Number(mixMat.materialWeight) || 0,
          percentage: Number(mixMat.percentage) || 0
        });
      }
    }

    // Process and validate steps with machines
    const processedSteps = [];
    for (let stepIndex = 0; stepIndex < data.steps.length; stepIndex++) {
      const stepEntry = data.steps[stepIndex];
      
      if (!stepEntry.stepId || !mongoose.Types.ObjectId.isValid(stepEntry.stepId)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            message: `Invalid or missing stepId at step index ${stepIndex}` 
          }),
        };
      }

      // Validate step exists
      const stepDoc = await Step.findById(stepEntry.stepId).lean();
      if (!stepDoc) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            message: `Step not found: ${stepEntry.stepId}` 
          }),
        };
      }

      // Process machines in this step
      const processedMachines = [];
      if (stepEntry.machines && Array.isArray(stepEntry.machines)) {
        for (let machineIndex = 0; machineIndex < stepEntry.machines.length; machineIndex++) {
          const machineData = stepEntry.machines[machineIndex];
          
          // Validate machine ID if provided
          if (machineData.machineId) {
            if (!mongoose.Types.ObjectId.isValid(machineData.machineId)) {
              return {
                statusCode: 400,
                body: JSON.stringify({ 
                  message: `Invalid machineId at step ${stepIndex}, machine ${machineIndex}` 
                })
              };
            }

            // Validate machine exists
            const machineDoc = await Machine.findById(machineData.machineId).lean();
            if (!machineDoc) {
              return {
                statusCode: 400,
                body: JSON.stringify({ 
                  message: `Machine not found: ${machineData.machineId} at step ${stepIndex}, machine ${machineIndex}` 
                })
              };
            }

            // Validate operator if provided
            let validatedOperatorId = null;
            if (machineData.operatorId && machineData.operatorId.trim() !== '') {
              if (!mongoose.Types.ObjectId.isValid(machineData.operatorId)) {
                return {
                  statusCode: 400,
                  body: JSON.stringify({ 
                    message: `Invalid operatorId at step ${stepIndex}, machine ${machineIndex}` 
                  })
                };
              }

              const operator = await User.findById(machineData.operatorId);
              if (!operator) {
                return {
                  statusCode: 400,
                  body: JSON.stringify({ 
                    message: `Operator not found: ${machineData.operatorId}` 
                  })
                };
              }
              validatedOperatorId = machineData.operatorId;
            }

            // FIXED: Set proper status based on machine index
            // First machine in step = 'pending', rest = 'none'
            const machineStatus = machineIndex === 0 ? 'pending' : 'none';

            processedMachines.push({
              machineId: machineData.machineId,
              machineName: machineData.machineName || machineDoc.machineName,
              machineType: machineData.machineType || machineDoc.machineType,
              operatorId: validatedOperatorId,
              status: machineStatus, // FIXED: Use calculated status
              startedAt: machineData.startedAt ? new Date(machineData.startedAt) : null,
              completedAt: machineData.completedAt ? new Date(machineData.completedAt) : null,
              note: machineData.note || null,
              reason: machineData.reason || null
            });
          } else {
            // If no machine ID provided, we can still create a placeholder entry
            console.warn(`Machine ID missing for step ${stepIndex}, machine ${machineIndex}: ${machineData.machineName}`);
            
            processedMachines.push({
              machineId: null, // Will need to be updated later
              machineName: machineData.machineName || '',
              machineType: machineData.machineType || '',
              operatorId: null,
              status: 'pending', // First machine
              startedAt: null,
              completedAt: null,
              note: null,
              reason: 'Machine ID not provided during order creation'
            });
          }
        }
      }

      processedSteps.push({
        stepId: stepEntry.stepId,
        machines: processedMachines
      });
    }

    // Create the order with the correct data structure
    const newOrder = new Order({
      customerId: data.customerId,
      
      // Material information
      materialId: data.materialId,
      materialTypeId: data.materialTypeId,
      materialWeight: Number(data.materialWeight) || 0,
      
      // Additional product specifications
      Width: Number(data.Width) || 0,
      Height: Number(data.Height) || 0,
      Thickness: Number(data.Thickness) || 0,
      SealingType: data.SealingType || '',
      BottomGusset: data.BottomGusset || '',
      AirHole: data.AirHole || '',
      Flap: data.Flap || '',
      Printing: Boolean(data.Printing),
      
      // Mix materials
      mixMaterial: validatedMixMaterials,
      
      // Manufacturing steps
      steps: processedSteps,
      
      // System fields - use actual user data from token
      branchId: data.branchId,
      createdBy: user.id, // Use actual user ID from token
      createdByRole: user.role, // Use actual user role from token
      
      // Additional fields
      // product27InfinityId: data.product27InfinityId,
      Notes: data.Notes || '',
      
      // Optional quantity field
      quantity: Number(data.quantity) || 1,
    });

    // FIXED: Initialize step machines with proper status before saving
    newOrder.initializeStepMachines();

    // Save the order
    await newOrder.save();

    console.log("Order created successfully:", {
      orderId: newOrder.orderId,
      customerId: newOrder.customerId,
      stepsCount: processedSteps.length,
      totalMachines: processedSteps.reduce((total, step) => total + step.machines.length, 0),
      createdBy: user.id,
      createdByRole: user.role,
      machineStatuses: newOrder.steps.map((step, idx) => ({
        step: idx,
        machines: step.machines.map((m, mIdx) => ({ index: mIdx, status: m.status }))
      }))
    });

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        message: 'Order created successfully', 
        orderId: newOrder.orderId,
        _id: newOrder._id,
        customerId: newOrder.customerId,
        stepsCount: processedSteps.length,
        totalMachines: processedSteps.reduce((total, step) => total + step.machines.length, 0),
        machinesWithIds: processedSteps.reduce((total, step) => 
          total + step.machines.filter(m => m.machineId).length, 0
        ),
        machineStatuses: newOrder.steps.map((step, idx) => ({
          step: idx,
          machines: step.machines.map((m, mIdx) => ({ 
            index: mIdx, 
            status: m.status,
            machineId: m.machineId 
          }))
        })),
        createdBy: user.username,
        createdByRole: user.role
      }),
    };

  } catch (err) {
    console.error("Error creating order:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: err.message 
      }),
    };
  }
};



module.exports.getAllOrders = async (event) => {
  console.log("=== getAllOrders Function Started ===");
  console.log("Event headers:", JSON.stringify(event.headers, null, 2));
  console.log("Query parameters:", JSON.stringify(event.queryStringParameters, null, 2));

  await mongoConnect();

  try {
    // Enhanced authentication validation with detailed logging
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log("Auth header received:", authHeader ? "Present" : "Missing");
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("❌ Authorization header missing or invalid format");
      return { 
        statusCode: 401, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Missing or invalid authorization header'
        }) 
      };
    }

    const user = verifyToken(authHeader);
    console.log("✅ Token verification result:", user ? "Success" : "Failed");
    
    if (!user || !user.id) {
      console.log("❌ Invalid or expired token");
      return { 
        statusCode: 401, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid or expired token'
        }) 
      };
    }

    // Extract and validate query parameters
    const queryParams = event.queryStringParameters || {};
    console.log("📋 Processing query parameters:", queryParams);
    
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      customerId,
      branchId,
      materialId,
      createdBy,
      startDate,
      endDate,
      search
    } = queryParams;

    // Validate and sanitize parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    
    console.log("📊 Pagination:", { pageNum, limitNum });

    // Validate sort parameters
    const allowedSortFields = ['createdAt', 'updatedAt', 'orderId', 'materialWeight', 'overallStatus'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';

    console.log("🔄 Sort settings:", { validSortBy, validSortOrder });

    // Enhanced ObjectId validation and conversion
    const validateAndConvertObjectId = (id) => {
      if (!id) return null;
      
      try {
        if (id instanceof mongoose.Types.ObjectId) {
          return id;
        }
        
        if (typeof id === 'string' && mongoose.isValidObjectId(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        
        return null;
      } catch (error) {
        console.log(`❌ Error converting ObjectId ${id}:`, error.message);
        return null;
      }
    };

    // Build filter object with enhanced role-based access control
    let filter = {};
    console.log("👤 User role-based filtering for role:", user.role);

    // Role-based filtering logic
    if (user.role === 'admin') {
      if (branchId) {
        const branchObjectId = validateAndConvertObjectId(branchId);
        if (branchObjectId) {
          filter.branchId = branchObjectId;
        }
      }
    } else if (user.role === 'manager') {
      if (branchId) {
        const branchObjectId = validateAndConvertObjectId(branchId);
        if (branchObjectId) {
          filter.branchId = branchObjectId;
        }
      } else {
        const userBranchObjectId = validateAndConvertObjectId(user.branchId);
        if (userBranchObjectId) {
          filter.branchId = userBranchObjectId;
        }
      }
    } else {
      const userBranchObjectId = validateAndConvertObjectId(user.branchId);
      if (userBranchObjectId) {
        filter.branchId = userBranchObjectId;
      }
    }

    // Apply additional filters
    if (status) {
      const allowedStatuses = ['pending', 'in_progress', 'dispatched', 'cancelled', 'Wait for Approval'];
      if (allowedStatuses.includes(status)) {
        filter.overallStatus = status;
      }
    }
    
    if (customerId) {
      const customerObjectId = validateAndConvertObjectId(customerId);
      if (customerObjectId) {
        filter.customerId = customerObjectId;
      }
    }
    
    if (materialId) {
      const materialObjectId = validateAndConvertObjectId(materialId);
      if (materialObjectId) {
        filter.materialId = materialObjectId;
      }
    }
    
    if (createdBy) {
      const createdByObjectId = validateAndConvertObjectId(createdBy);
      if (createdByObjectId) {
        filter.createdBy = createdByObjectId;
      }
    }

    // Enhanced date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          filter.createdAt.$gte = start;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    // Enhanced search functionality
    if (search && typeof search === 'string') {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      
      filter.$or = [
        { orderId: searchRegex }
      ];
    }

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[validSortBy] = validSortOrder === 'desc' ? -1 : 1;

    console.log("🎯 Final filter object:", JSON.stringify(filter, null, 2));

    // FIXED AGGREGATION PIPELINE - CORRECTED FIELD NAMES AND STRUCTURE
    const pipeline = [
      { $match: filter },
      
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
      
      // Handle mix materials if they exist - FIXED
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
      
      // Extract all machine IDs from steps - FIXED
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
      
      // Lookup all machine details at once - FIXED WITH CORRECT FIELD NAMES
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
                // FIXED: Using correct field name 'type' from MachineType schema
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
      
      // Lookup step details - FIXED
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
          // Flatten single document arrays
          customer: { $arrayElemAt: ['$customer', 0] },
          branch: { $arrayElemAt: ['$branch', 0] },
          material: { $arrayElemAt: ['$material', 0] },
          creator: { $arrayElemAt: ['$creator', 0] },
          
          // Process mix materials with weights - FIXED
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
          
          // Process steps with complete machine information - FIXED WITH CORRECT FIELD NAMES
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
                    // Get step details
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
                    // Process machines with complete details - FIXED
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
                              // Get machine details from lookup - COMPLETE MACHINE INFO
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
                              // Legacy fields for backward compatibility - FIXED
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
                              // Additional size fields for direct access
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
          
          // Calculate progress metrics - FIXED
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
      
      // Calculate progress percentage
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
      
      // Clean up temporary fields
      {
        $project: {
          allMachineIds: 0,
          allMachineDetails: 0,
          stepDetails: 0,
          mixMaterialDetails: 0
        }
      },
      
      // Sort the results
      { $sort: sortObj },
      
      // Use facet to get paginated data and metadata in one query
      {
        $facet: {
          orders: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: 'count' }
          ],
          statusCounts: [
            {
              $group: {
                _id: '$overallStatus',
                count: { $sum: 1 }
              }
            }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalWeight: { $sum: { $ifNull: ['$materialWeight', 0] } },
                avgWeight: { $avg: { $ifNull: ['$materialWeight', 0] } }
              }
            }
          ]
        }
      }
    ];

    console.log("🚀 Executing optimized aggregation pipeline...");

    // Execute aggregation with timeout
    const startTime = Date.now();
    let result;
    
    try {
      result = await Promise.race([
        Order.aggregate(pipeline).allowDiskUse(true).exec(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]);
    } catch (aggregationError) {
      console.error("❌ Aggregation pipeline failed:", aggregationError);
      throw aggregationError;
    }
    
    const queryTime = Date.now() - startTime;
    console.log(`⚡ Query executed in ${queryTime}ms`);

    // Process results
    const aggregationResult = Array.isArray(result) && result.length > 0 ? result[0] : {
      orders: [],
      totalCount: [],
      statusCounts: [],
      summary: []
    };

    const orders = aggregationResult.orders || [];
    
    // Enhanced debugging for machine details
    console.log(`📊 Retrieved ${orders.length} orders`);
    
    if (orders.length > 0) {
      console.log("\n=== MACHINE DETAILS DEBUG ===");
      orders.slice(0, 2).forEach((order, orderIndex) => {
        console.log(`\nOrder ${orderIndex + 1}: ${order.orderId}`);
        
        if (order.steps && order.steps.length > 0) {
          order.steps.forEach((step, stepIndex) => {
            console.log(`  Step ${stepIndex + 1}: ${step.stepDetails?.stepName || 'Unknown Step'}`);
            
            if (step.machines && step.machines.length > 0) {
              step.machines.forEach((machine, machineIndex) => {
                console.log(`    Machine ${machineIndex + 1}:`);
                console.log(`      ID: ${machine.machineId || 'N/A'}`);
                console.log(`      Name: ${machine.machineName || machine.machineDetails?.machineName || 'Unknown'}`);
                console.log(`      Type: ${machine.machineTypeName || machine.machineDetails?.machineTypeName || 'Unknown'}`);
                console.log(`      Status: ${machine.status || 'Unknown'}`);
                console.log(`      Size X: ${machine.sizeX || machine.machineDetails?.sizeX || 'N/A'}`);
                console.log(`      Size Y: ${machine.sizeY || machine.machineDetails?.sizeY || 'N/A'}`);
                console.log(`      Size Z: ${machine.sizeZ || machine.machineDetails?.sizeZ || 'N/A'}`);
                
                if (machine.machineDetails) {
                  console.log(`      Details Available: ✅`);
                  console.log(`      Description: ${machine.machineDetails.machineTypeDescription || 'N/A'}`);
                }
              });
            } else {
              console.log(`    No machines found for step ${stepIndex + 1}`);
            }
          });
        } else {
          console.log(`  No steps found for order ${orderIndex + 1}`);
        }
      });
    }
    
    const totalOrders = aggregationResult.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalOrders / limitNum);
    
    const statusCounts = (aggregationResult.statusCounts || []).reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count;
      return acc;
    }, {});
    
    const summary = aggregationResult.summary[0] || {
      totalOrders: 0,
      totalWeight: 0,
      avgWeight: 0
    };

    // Enhanced response format
    const responseData = {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalOrders,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
          showing: orders.length
        },
        summary,
        statusCounts,
        filters: {
          applied: filter,
          available: {
            sortBy: allowedSortFields,
            sortOrder: ['asc', 'desc'],
            statuses: ['pending', 'in_progress', 'dispatched', 'cancelled', 'Wait for Approval']
          }
        },
        meta: {
          queryTime,
          timestamp: new Date().toISOString(),
          userRole: user.role,
          userId: user.id
        }
      }
    };

    console.log("✅ Orders retrieved successfully:", {
      count: orders.length,
      totalPages,
      currentPage: pageNum,
      totalOrders,
      queryTime
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(responseData)
    };

  } catch (err) {
    console.error("❌ Error retrieving orders:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    // Enhanced error handling
    let statusCode = 500;
    let message = 'Internal server error';

    if (err.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid ID format provided';
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Invalid data provided';
    } else if (err.message === 'Query timeout') {
      statusCode = 408;
      message = 'Request timeout - query took too long';
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ 
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
      })
    };
  }
};


// Add this new function for customer-specific orders
module.exports.getCustomerOrders = async (event) => {
  console.log("=== getCustomerOrders Function Started ===");
  console.log("Event headers:", JSON.stringify(event.headers, null, 2));
  console.log("Query parameters:", JSON.stringify(event.queryStringParameters, null, 2));

  await mongoConnect();

  try {
    // Enhanced authentication validation with detailed logging
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log("Auth header received:", authHeader ? "Present" : "Missing");
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("❌ Authorization header missing or invalid format");
      return { 
        statusCode: 401, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Missing or invalid authorization header'
        }) 
      };
    }

    const user = verifyToken(authHeader);
    console.log("✅ Token verification result:", user ? "Success" : "Failed");
    
    if (!user || !user.id) {
      console.log("❌ Invalid or expired token");
      return { 
        statusCode: 401, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ 
          success: false,
          message: 'Invalid or expired token'
        }) 
      };
    }

    // Extract and validate query parameters
    const queryParams = event.queryStringParameters || {};
    console.log("📋 Processing query parameters:", queryParams);
    
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      startDate,
      endDate,
      search
    } = queryParams;

    // Validate and sanitize parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    
    console.log("📊 Pagination:", { pageNum, limitNum });

    // Validate sort parameters
    const allowedSortFields = ['createdAt', 'updatedAt', 'orderId', 'materialWeight', 'overallStatus'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';

    console.log("🔄 Sort settings:", { validSortBy, validSortOrder });
    const rawCustomerId = event.headers.customerId;

const validateAndConvertObjectId = (id) => {
  if (!id) return null;
  try {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (typeof id === 'string' && mongoose.isValidObjectId(id)) {
      return new mongoose.Types.ObjectId(id);
    }
    return null;
  } catch (error) {
    console.log(`❌ Error converting ObjectId ${id}:`, error.message);
    return null;
  }
};

const customerObjectId = validateAndConvertObjectId(rawCustomerId);

if (!customerObjectId) {
  console.log("❌ Invalid or missing customer ID");
  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify({ 
      success: false,
      message: 'Missing or invalid customerId in headers'
    })
  };
}




// Final check
if (!customerObjectId) {
  console.log("❌ No valid customer ID found");
  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify({ 
      success: false,
      message: 'Invalid customer ID'
    })
  };
}
    // Build filter object - Filter by customer ID
    let filter = {
      customerId: customerObjectId
    };

    console.log("👤 Customer-specific filtering for user:", user.email || user.username);
    console.log("🎯 Customer ObjectId:", customerObjectId);

    // Apply additional filters
    if (status) {
      const allowedStatuses = ['pending', 'in_progress', 'dispatched', 'cancelled', 'Wait for Approval'];
      if (allowedStatuses.includes(status)) {
        filter.overallStatus = status;
      }
    }

    // Enhanced date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          filter.createdAt.$gte = start;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    // Enhanced search functionality
    if (search && typeof search === 'string') {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      
      filter.$or = [
        { orderId: searchRegex }
      ];
    }

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[validSortBy] = validSortOrder === 'desc' ? -1 : 1;

    console.log("🎯 Final filter object:", JSON.stringify(filter, null, 2));

    // Use the same aggregation pipeline as in your original function
    const pipeline = [
      { $match: filter },
      
      // Lookup customer details
      {
        $lookup: {
          from: 'customers',
          let: { customerId: '$customerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$customerId'] } } },
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
          ],
          as: 'customer'
        }
      },
      
      // Lookup branch details
      {
        $lookup: {
          from: 'branches',
          let: { branchId: '$branchId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$branchId'] } } },
            { $project: { name: 1, code: 1, address: 1, phone: 1, email: 1 } }
          ],
          as: 'branch'
        }
      },
      
      // Lookup material details
      {
        $lookup: {
          from: 'materials',
          let: { materialId: '$materialId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$materialId'] } } },
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
                materialTypeName: { $arrayElemAt: ['$materialTypeDetails.materialTypeName', 0] }
              }
            }
          ],
          as: 'material'
        }
      },
      
      // Add computed fields and flatten arrays
      {
        $addFields: {
          customer: { $arrayElemAt: ['$customer', 0] },
          branch: { $arrayElemAt: ['$branch', 0] },
          material: { $arrayElemAt: ['$material', 0] },
          
          // Progress calculations
          totalSteps: { 
            $cond: [
              { $isArray: '$steps' }, 
              { $size: '$steps' }, 
              0
            ]
          },
          completedSteps: {
            $cond: [
              { $isArray: '$steps' },
              {
                $size: {
                  $filter: {
                    input: '$steps',
                    as: 'step',
                    cond: {
                      $cond: [
                        { $isArray: '$$step.machines' },
                        {
                          $allElementsTrue: {
                            $map: {
                              input: '$$step.machines',
                              as: 'machine',
                              in: { $eq: ['$$machine.status', 'completed'] }
                            }
                          }
                        },
                        false
                      ]
                    }
                  }
                }
              },
              0
            ]
          },
          
          // Progress percentage
          progressPercentage: {
            $cond: [
              { 
                $and: [
                  { $isArray: '$steps' },
                  { $gt: [{ $size: '$steps' }, 0] }
                ]
              },
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$steps',
                            as: 'step',
                            cond: {
                              $cond: [
                                { $isArray: '$$step.machines' },
                                {
                                  $allElementsTrue: {
                                    $map: {
                                      input: '$$step.machines',
                                      as: 'machine',
                                      in: { $eq: ['$$machine.status', 'completed'] }
                                    }
                                  }
                                },
                                false
                              ]
                            }
                          }
                        }
                      },
                      { $size: '$steps' }
                    ]
                  },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      
      // Sort
      { $sort: sortObj },
      
      // Use $facet to get data and counts in one query
      {
        $facet: {
          orders: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: 'count' }
          ],
          statusCounts: [
            {
              $group: {
                _id: '$overallStatus',
                count: { $sum: 1 }
              }
            }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalWeight: { $sum: { $ifNull: ['$materialWeight', 0] } },
                avgWeight: { $avg: { $ifNull: ['$materialWeight', 0] } }
              }
            }
          ]
        }
      }
    ];

    console.log("🚀 Executing customer orders aggregation pipeline...");

    // Execute aggregation
    const startTime = Date.now();
    let result;
    
    try {
      result = await Promise.race([
        Order.aggregate(pipeline).allowDiskUse(true).exec(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]);
    } catch (aggregationError) {
      console.error("❌ Aggregation pipeline failed:", aggregationError);
      throw aggregationError;
    }
    
    const queryTime = Date.now() - startTime;
    console.log(`⚡ Customer orders query executed in ${queryTime}ms`);

    // Process results
    const aggregationResult = Array.isArray(result) && result.length > 0 ? result[0] : {
      orders: [],
      totalCount: [],
      statusCounts: [],
      summary: []
    };

    const orders = aggregationResult.orders || [];
    const totalOrders = aggregationResult.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalOrders / limitNum);
    
    const statusCounts = (aggregationResult.statusCounts || []).reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count;
      return acc;
    }, {});
    
    const summary = aggregationResult.summary[0] || {
      totalOrders: 0,
      totalWeight: 0,
      avgWeight: 0
    };

    // Enhanced response format
    const responseData = {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalOrders,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
          showing: orders.length
        },
        summary,
        statusCounts,
        filters: {
          applied: filter,
          available: {
            sortBy: allowedSortFields,
            sortOrder: ['asc', 'desc'],
            statuses: ['pending', 'in_progress', 'dispatched', 'cancelled', 'Wait for Approval']
          }
        },
        meta: {
          queryTime,
          timestamp: new Date().toISOString(),
          userRole: user.role,
          userId: user.id,
          customerFilter: true  // Indicates this is customer-filtered
        }
      }
    };

    console.log("✅ Retrieved customer orders successfully:", {
      customerId: rawCustomerId,
      count: orders.length,
      totalPages,
      currentPage: pageNum,
      totalOrders,
      queryTime
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(responseData)
    };

  } catch (err) {
    console.error("❌ Error retrieving customer orders:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    // Enhanced error handling
    let statusCode = 500;
    let message = 'Internal server error';

    if (err.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid ID format provided';
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Invalid data provided';
    } else if (err.message === 'Query timeout') {
      statusCode = 408;
      message = 'Request timeout - query took too long';
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ 
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
      })
    };
  }
};

