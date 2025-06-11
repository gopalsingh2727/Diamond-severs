const mongoose = require('mongoose');
const Product = require('../../models/product/product');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');

// ✅ CREATE PRODUCT
module.exports.createProduct = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (user.role !== 'admin' && user.role !== 'manager') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const { productName, productType, price, sizeX, sizeY, sizeZ, branchId: bodyBranchId } = body;

    if (!productName || !productType || !price || !sizeX || !sizeY || !sizeZ) {
      return { statusCode: 400, body: JSON.stringify({ message: 'All fields are required' }) };
    }

    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;

    const existing = await Product.findOne({ productName, branchId });
    if (existing) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Product name must be unique in this branch' }) };
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

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Product created', product }),
    };
  } catch (err) {
    console.error("Create product error:", err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ GET PRODUCTS
module.exports.getProducts = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    let filter = {};
    if (user.role === 'manager') {
      filter.branchId = user.branchId;
    }

    const products = await Product.find(filter)
      .populate('productType', 'name description')
      .populate('branchId', 'name location');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Products fetched',
        count: products.length,
        products,
      }),
    };
  } catch (err) {
    console.error("Get products error:", err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ UPDATE PRODUCT
module.exports.updateProduct = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;
    const body = JSON.parse(event.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid product ID' }) };
    }

    const product = await Product.findById(id);
    if (!product) return { statusCode: 404, body: JSON.stringify({ message: 'Product not found' }) };

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized to update this product' }) };
    }

    // Unique name check
    if (body.productName && body.productName !== product.productName) {
      const nameExists = await Product.findOne({
        productName: body.productName,
        _id: { $ne: id },
        branchId: product.branchId,
      });
      if (nameExists) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Product name already exists' }) };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Product updated successfully', product }),
    };
  } catch (err) {
    console.error("Update product error:", err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

// ✅ DELETE PRODUCT
module.exports.deleteProduct = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const { id } = event.pathParameters;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid product ID' }) };
    }

    const product = await Product.findById(id);
    if (!product) return { statusCode: 404, body: JSON.stringify({ message: 'Product not found' }) };

    if (user.role !== 'admin' && user.branchId !== String(product.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized to delete this product' }) };
    }

    await product.deleteOne();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Product deleted successfully' }),
    };
  } catch (err) {
    console.error("Delete product error:", err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};