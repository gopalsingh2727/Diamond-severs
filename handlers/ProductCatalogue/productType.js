const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const ProductType = require('../../models/ProductCatalogue/productType');
const Product = require('../../models/product/product');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  // Case-insensitive check for x-api-key header
  const headers = event.headers || {};
  const apiKeyHeader = Object.keys(headers).find(
    (h) => h.toLowerCase() === 'x-api-key'
  );
  const apiKey = apiKeyHeader ? headers[apiKeyHeader] : null;
  return apiKey === process.env.API_KEY;
};

module.exports.createProductType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);
    const { productTypeName, branchId: bodyBranchId } = body;

    if (!productTypeName) {
      return respond(400, { message: 'Product type name is required' });
    }

    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    if (!branchId) {
      return respond(400, { message: 'Branch ID is required' });
    }

    const exists = await ProductType.findOne({
      productTypeName: { $regex: `^${productTypeName}$`, $options: 'i' },
      branchId,
    });

    if (exists) {
      return respond(400, { message: 'Product type already exists in this branch' });
    }

    const productType = new ProductType({ productTypeName, branchId });
    await productType.save();

    return respond(201, productType);

  } catch (error) {
    console.error('Create Product Type Error:', error);
    return respond(500, { message: error.message });
  }
};

module.exports.getProductTypes = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return respond(401, { message: "Authorization header missing" });
    }
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: "Unauthorized access" });
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};
    const productTypes = await ProductType.find(filter).sort({ productTypeName: 1 });

    return respond(200, productTypes);

  } catch (error) {
    console.error("Get Product Types Error:", error);
    return respond(500, { message: error.message || "Server error" });
  }
};

module.exports.updateProductType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const id = event.pathParameters && event.pathParameters.id;
    if (!id) {
      return respond(400, { message: 'Product Type ID missing in path' });
    }

    const productType = await ProductType.findById(id);
    if (!productType) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(productType.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    const body = JSON.parse(event.body);

    productType.productTypeName = body.productTypeName || productType.productTypeName;
    productType.description = body.description || productType.description;

    await productType.save();

    return respond(200, productType);

  } catch (error) {
    console.error("Update Product Type Error:", error);
    return respond(500, { message: error.message });
  }
};

module.exports.deleteProductType = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const id = event.pathParameters && event.pathParameters.id;
    if (!id) {
      return respond(400, { message: 'Product Type ID missing in path' });
    }

    const productType = await ProductType.findById(id);
    if (!productType) {
      return respond(404, { message: 'Not found' });
    }

    if (user.role !== 'admin' && user.branchId !== String(productType.branchId)) {
      return respond(403, { message: 'Unauthorized' });
    }

    await productType.deleteOne();

    return respond(200, { message: 'Deleted successfully' });

  } catch (error) {
    console.error("Delete Product Type Error:", error);
    return respond(500, { message: error.message });
  }
};

module.exports.getAllProductTypesWithProducts = async (event) => {
  if (!checkApiKey(event)) {
    return respond(401, { message: 'Invalid API key' });
  }
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return respond(403, { message: "Unauthorized access" });
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const productTypes = await ProductType.find(filter);
    const results = await Promise.all(
      productTypes.map(async (type) => {
        const products = await Product.find({ productType: type._id });
        return {
          ...type.toObject(),
          products,
        };
      })
    );

    return respond(200, results);

  } catch (err) {
    console.error('Error fetching product types with products:', err);
    return respond(500, { message: err.message });
  }
};