const MaterialType = require('../../models/MaterialType/materialType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const Material = require('../../models/Material/material');


module.exports.createMaterialType = async (event) => {
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }

    if (!body.materialTypeName || (user.role === 'admin' && !body.branchId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Required fields missing' })
      };
    }

    const exists = await MaterialType.findOne({ materialTypeName: body.materialTypeName });
    if (exists) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Material type must be unique' })
      };
    }

  const materialType = new MaterialType({
  materialTypeName: body.materialTypeName,
  branchId: user.role === 'admin' ? body.branchId : user.branchId,
});

    await materialType.save();

    return {
      statusCode: 201,
      body: JSON.stringify(materialType)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message })
    };
  }
};
// ✅ Get Material Types
module.exports.getMaterialTypes = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    const materialTypes = await MaterialType.find(filter).populate('productId');
    return {
      statusCode: 200,
      body: JSON.stringify(materialTypes)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ Update Material Type
module.exports.updateMaterialType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body);

    const materialType = await MaterialType.findById(id);
    if (!materialType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(materialType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    materialType.materialTypeName = body.materialTypeName || materialType.materialTypeName;
    materialType.productId = body.productId || materialType.productId;

    await materialType.save();
    return {
      statusCode: 200,
      body: JSON.stringify(materialType)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ Delete Material Type
module.exports.deleteMaterialType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;

    const materialType = await MaterialType.findById(id);
    if (!materialType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(materialType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    await materialType.deleteOne();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Deleted successfully' })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

module.exports.getAllMaterialTypesWithMaterials = async (event) => {
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('Error fetching material types with materials:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};



