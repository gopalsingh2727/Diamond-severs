const connect = require('../../config/mongodb/db');
const verifyToken = require('../../utiles/verifyToken');
const ProductType = require('../../models/ProductCatalogue/productType');
const Product = require('../../models/product/product');

module.exports.createProductType = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    const body = JSON.parse(event.body);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const { productTypeName, branchId: bodyBranchId } = body;
    if (!productTypeName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Product type name is required' }),
      };
    }

    const branchId = user.role === 'admin' ? bodyBranchId : user.branchId;
    if (!branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Branch ID is required' }),
      };
    }

    const exists = await ProductType.findOne({
      productTypeName: { $regex: `^${productTypeName}$`, $options: 'i' },
      branchId,
    });

    if (exists) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Product type already exists in this branch' }),
      };
    }

    const productType = new ProductType({ productTypeName, branchId });
    await productType.save();

    return {
      statusCode: 201,
      body: JSON.stringify(productType),
    };

  } catch (error) {
    console.error('Create Product Type Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

module.exports.getProductTypes = async (event) => {
  await connect();
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Authorization header missing" }),
      };
    }

    const user = verifyToken(authHeader);
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Unauthorized access" }),
      };
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};
    const productTypes = await ProductType.find(filter).sort({ productTypeName: 1 });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(productTypes),
    };

  } catch (error) {
    console.error("Get Product Types Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Server error" }),
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
    productType.description = body.description || productType.description;

    await productType.save();

    return {
      statusCode: 200,
      body: JSON.stringify(productType),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
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
      body: JSON.stringify({ message: 'Deleted successfully' }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

module.exports.getAllProductTypesWithProducts = async (event) => {
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('Error fetching product types with products:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};