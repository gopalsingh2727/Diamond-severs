const ProductType = require('../../models/ProductCatalogue/productType');
const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');


module.exports.createProductType = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (user.role !== 'admin' && user.role !== 'manager') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const exists = await ProductType.findOne({ productTypeName: body.productTypeName });
    if (exists) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Product type must be unique' }) };
    }

    const productType = new ProductType({
      productTypeName: body.productTypeName,
      branchId: user.role === 'admin' ? body.branchId : user.branchId
    });

    await productType.save();
    return {
      statusCode: 201,
      body: JSON.stringify(productType)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};


module.exports.getProductTypes = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const productTypes = await ProductType.find(filter);
    return {
      statusCode: 200,
      body: JSON.stringify(productTypes)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};


module.exports.updateProductType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const body = JSON.parse(event.body);
    const id = event.pathParameters.id;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(productType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    productType.productTypeName = body.productTypeName || productType.productTypeName;
    await productType.save();

    return {
      statusCode: 200,
      body: JSON.stringify(productType)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};


module.exports.deleteProductType = async (event) => {
  await connect();
  try {
    const user = verifyToken(event.headers.authorization);
    const id = event.pathParameters.id;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Not found' }) };
    }

    if (user.role !== 'admin' && user.branchId !== String(productType.branchId)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    await productType.deleteOne();
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