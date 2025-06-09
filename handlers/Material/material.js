const Material = require('../../models/Material/material');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');

// Create Material
module.exports.createMaterial = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (user.role !== 'admin' && user.role !== 'manager') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    // Check uniqueness of materialName
    const exists = await Material.findOne({ materialName: body.materialName });
    if (exists) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Material name must be unique' }) };
    }

    const material = new Material({
      materialName: body.materialName,
      materialType: body.materialType,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });

    await material.save();

    return {
      statusCode: 201,
      body: JSON.stringify(material)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};

// Get Materials (filtered by branch if manager)
module.exports.getMaterials = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);

    const filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    const materials = await Material.find(filter).populate('materialType');
    return {
      statusCode: 200,
      body: JSON.stringify(materials)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};

// Update Material
module.exports.updateMaterial = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body);

    const material = await Material.findById(id);
    if (!material) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(material.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    // Check unique name if changed
    if (body.materialName && body.materialName !== material.materialName) {
      const exists = await Material.findOne({ materialName: body.materialName });
      if (exists) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Material name must be unique' }) };
      }
      material.materialName = body.materialName;
    }

    if (body.materialType) material.materialType = body.materialType;

    await material.save();

    return {
      statusCode: 200,
      body: JSON.stringify(material)
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};

// Delete Material
module.exports.deleteMaterial = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;

    const material = await Material.findById(id);
    if (!material) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(material.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    await material.deleteOne();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Deleted successfully' })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};