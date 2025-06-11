const MachineType = require('../../models/MachineType/MachineType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Machine = require('../../models/Machine/machine');


module.exports.createMachineType = async (event) => {
  await connect();


  
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    // Only admin or branch manager
    if (user.role !== 'admin' && user.role !== 'manager') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const exists = await MachineType.findOne({ type: body.type });
    if (exists) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Machine type must be unique' }) };
    }

    const machineType = new MachineType({
      type: body.type,
      description: body.description,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });
     console.log(machineType);
     
    await machineType.save();
    return {
      statusCode: 201,
      body: JSON.stringify(machineType)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

// ✅ Get All Machine Types
module.exports.getMachineTypes = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);


    if (user.role !== 'admin' && user.role !== 'manager') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    // Filter for manager's own branch
    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const machineTypes = await MachineType.find(filter);

    return {
      statusCode: 200,
      body: JSON.stringify(machineTypes)
    };

  } catch (error) {
    console.error("getMachineTypes error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

// ✅ Update Machine Type
module.exports.updateMachineType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const body = JSON.parse(event.body);
    const id = event.pathParameters.id;

    const machineType = await MachineType.findById(id);
    if (!machineType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    // Only admin or same-branch manager
    if (user.role !== 'admin' && user.branchId !== String(machineType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    machineType.type = body.type || machineType.type;
    machineType.description = body.description || machineType.description;
    await machineType.save();

    return {
      statusCode: 200,
      body: JSON.stringify(machineType)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

// ✅ Delete Machine Type
module.exports.deleteMachineType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;

    const machineType = await MachineType.findById(id);
    if (!machineType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    // Only admin or same-branch manager
    if (user.role !== 'admin' && user.branchId !== String(machineType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    await machineType.deleteOne();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Deleted successfully' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

module.exports.getAllMachineTypesWithMachines = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Unauthorized access" }),
      };
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const machineTypes = await MachineType.find(filter);

    // Attach machines manually to each machineType
    const results = await Promise.all(
      machineTypes.map(async (type) => {
        const machines = await Machine.find({ machineType: type._id });
        return {
          ...type.toObject(),
          machines,
        };
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('Error fetching machine types with machines:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};