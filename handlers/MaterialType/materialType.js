const MaterialType = require('../../models/MaterialType/materialType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Material = require('../../models/Material/material');
const mongoose = require('mongoose'); // Needed for ObjectId validation

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

// ✅ Create Material Type
module.exports.createMaterialType = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
      console.log(user);
      
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const body = JSON.parse(event.body);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    if (!body.materialTypeName || (user.role === 'admin' && !body.branchId)) {
      return respond(400, { message: 'Required fields missing' });
    }

    const exists = await MaterialType.findOne({ materialTypeName: body.materialTypeName });
    if (exists) {
      return respond(400, { message: 'Material type must be unique' });
    }

    const materialType = new MaterialType({
      materialTypeName: body.materialTypeName,
      branchId: user.role === 'admin' ? body.branchId : user.branchId,
    });

    await materialType.save();
    return respond(201, materialType);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ✅ Get Material Types
module.exports.getMaterialTypes = async (event) => {
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

    let filter = {};

if (user.role === "manager") {
  filter.branchId = user.branchId;
} else if (user.role === "admin" && event.queryStringParameters?.branchId) {
  filter.branchId = event.queryStringParameters.branchId;
}


const materialTypes = await MaterialType.find(filter);
    return respond(200, materialTypes);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ✅ Update Material Type
module.exports.updateMaterialType = async (event) => {
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

    const id = event.pathParameters.id;
    const body = JSON.parse(event.body);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid ID' });
    }

    const materialType = await MaterialType.findById(id);
    if (!materialType) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(materialType.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    materialType.materialTypeName = body.materialTypeName || materialType.materialTypeName;
    materialType.productId = body.productId || materialType.productId;

    await materialType.save();
    return respond(200, materialType);
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ✅ Delete Material Type
module.exports.deleteMaterialType = async (event) => {
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

    const id = event.pathParameters.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid ID' });
    }

    const materialType = await MaterialType.findById(id);
    if (!materialType) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(materialType.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    await materialType.deleteOne();
    return respond(200, { message: 'Deleted successfully' });
  } catch (err) {
    return respond(500, { message: err.message });
  }
};

// ✅ Get All Material Types With Materials
module.exports.getAllMaterialTypesWithMaterials = async (event) => {
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

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized access' });
    }
    
    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};
    const materialTypes = await MaterialType.find(filter);

    const results = await Promise.all(
      materialTypes.map(async (type) => {
        const materials = await Material.find({ materialType: type._id });
        return {
          ...type.toObject(),
          materials,
          

        };
      })
    );

    return respond(200, results);
  } catch (err) {
    console.error('Error fetching material types with materials:', err);
    return respond(500, { message: err.message });
  }
};