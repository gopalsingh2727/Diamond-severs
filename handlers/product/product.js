const mongoose = require('mongoose');
const Product = require('../../models/product/product');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');

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

// CREATE PRODUCT
module.exports.createProduct = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const body = JSON.parse(event.body);
    const { productName, productType, price, sizeX, sizeY, sizeZ, branchId: bodyBranchId } = body;

    if (
      [productName, productType, price, sizeX, sizeY, sizeZ].some(v => v === undefined)
    ) {
      return respond(400, { message: 'All fields are required' });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return respond(403, { message: 'Unauthorized' });
    }

    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;

    const existing = await Product.findOne({ productName, branchId });
    if (existing) {
      return respond(400, { message: 'Product name must be unique in this branch' });
    }

    const product = new Product({
      productName,
      productType,
      price,
      sizeX,
      sizeY,
      sizeZ,
      branchId,
    });

    await product.save();

    return respond(201, { message: 'Product created', product });
  } catch (err) {
    console.error("Create product error:", err);
    return respond(500, { message: err.message });
  }
};

// GET PRODUCTS
module.exports.getProducts = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    const products = await Product.find(filter)
      .populate('productType', 'name description')
      .populate('branchId', 'name location');

    return respond(200, {
      message: 'Products fetched',
      count: products.length,
      products,
    });
  } catch (err) {
    console.error("Get products error:", err);
    return respond(500, { message: err.message });
  }
};

// UPDATE PRODUCT
module.exports.updateProduct = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const { id } = event.pathParameters || {};
    if (!id) return respond(400, { message: 'Product ID is required' });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) return respond(404, { message: 'Product not found' });

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return respond(403, { message: 'Unauthorized to update this product' });
    }

    const body = JSON.parse(event.body);

    // Unique name check if changed
    if (body.productName && body.productName !== product.productName) {
      const nameExists = await Product.findOne({
        productName: body.productName,
        _id: { $ne: id },
        branchId: product.branchId,
      });
      if (nameExists) {
        return respond(400, { message: 'Product name already exists' });
      }
    }

    // Update fields
    product.productName = body.productName || product.productName;
    product.productType = body.productType || product.productType;
    product.price = body.price || product.price;
    product.sizeX = body.sizeX || product.sizeX;
    product.sizeY = body.sizeY || product.sizeY;
    product.sizeZ = body.sizeZ || product.sizeZ;

    await product.save();

    return respond(200, { message: 'Product updated successfully', product });
  } catch (err) {
    console.error("Update product error:", err);
    return respond(500, { message: err.message });
  }
};

// DELETE PRODUCT
module.exports.deleteProduct = async (event) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    const { id } = event.pathParameters || {};
    if (!id) return respond(400, { message: 'Product ID is required' });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) return respond(404, { message: 'Product not found' });

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return respond(403, { message: 'Unauthorized to delete this product' });
    }

    await product.deleteOne();

    return respond(200, { message: 'Product deleted successfully' });
  } catch (err) {
    console.error("Delete product error:", err);
    return respond(500, { message: err.message });
  }
};