const Material = require('../../models/Material/material');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const mongoose = require('mongoose');

// Utility: Standard response
const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

// Utility: Check API key
const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};

// Create Material
module.exports.createMaterial = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const body = JSON.parse(event.body);

    if (!body.materialName || typeof body.materialName !== 'string') {
      return respond(400, { message: 'Material name is required and must be a string' });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return respond(403, { message: 'Unauthorized' });
    }

    const exists = await Material.findOne({ materialName: body.materialName });
    if (exists) {
      return respond(400, { message: 'Material name must be unique' });
    }

    const material = new Material({
      materialName: body.materialName,
      materialType: body.materialType,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });

    await material.save();
    return respond(201, material);

  } catch (error) {
    return respond(500, { message: error.message });
  }
};

// Get Materials
module.exports.getMaterials = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    let user;
    try {
      user = verifyToken(event.headers.authorization || event.headers.Authorization);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};
    const materials = await Material.find(filter).populate('materialType');

    return respond(200, materials);

  } catch (error) {
    return respond(500, { message: error.message });
  }
};

// Update Material
module.exports.updateMaterial = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    let user;
    try {
      user = verifyToken(event.headers.authorization || event.headers.Authorization);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const id = event.pathParameters.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid ID' });
    }

    const material = await Material.findById(id);
    if (!material) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(material.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);

    if (body.materialName && body.materialName !== material.materialName) {
      const exists = await Material.findOne({ materialName: body.materialName });
      if (exists) {
        return respond(400, { message: 'Material name must be unique' });
      }
      material.materialName = body.materialName;
    }

    if (body.materialType) material.materialType = body.materialType;

    await material.save();
    return respond(200, material);

  } catch (error) {
    return respond(500, { message: error.message });
  }
};

// Delete Material
module.exports.deleteMaterial = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    let user;
    try {
      user = verifyToken(event.headers.authorization || event.headers.Authorization);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const id = event.pathParameters.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid ID' });
    }

    const material = await Material.findById(id);
    if (!material) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(material.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    await material.deleteOne();
    return respond(200, { message: 'Deleted successfully' });

  } catch (error) {
    return respond(500, { message: error.message });
  }
};