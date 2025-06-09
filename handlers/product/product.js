const Product = require('../../models/product/product');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');


module.exports.createProduct = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (user.role !== 'admin' && user.role !== 'manager') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const existing = await Product.findOne({ productName: body.productName });
    if (existing) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Product name must be unique' }) };
    }

    const product = new Product({
      productName: body.productName,
      productType: body.productType,
      sizeX: body.sizeX,
      sizeY: body.sizeY,
      sizeZ: body.sizeZ,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });

    await product.save();
    return {
      statusCode: 201,
      body: JSON.stringify(product)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ Get Products
module.exports.getProducts = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);

    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    const products = await Product.find(filter).populate('productType');
    return { statusCode: 200, body: JSON.stringify(products) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ Update Product
module.exports.updateProduct = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body);

    const product = await Product.findById(id);
    if (!product) return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    product.productName = body.productName || product.productName;
    product.productType = body.productType || product.productType;
    product.sizeX = body.sizeX || product.sizeX;
    product.sizeY = body.sizeY || product.sizeY;
    product.sizeZ = body.sizeZ || product.sizeZ;

    await product.save();
    return { statusCode: 200, body: JSON.stringify(product) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ Delete Product
module.exports.deleteProduct = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;

    const product = await Product.findById(id);
    if (!product) return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    await product.deleteOne();
    return { statusCode: 200, body: JSON.stringify({ message: 'Deleted successfully' }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};