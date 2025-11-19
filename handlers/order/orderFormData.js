const Account = require("../../models/Customer/customer");
const ProductType = require("../../models/ProductCatalogue/productType");
const Product = require("../../models/product/product");
const ProductSpec = require("../../models/productSpecSchema/productSpecSchema");
const MaterialType = require("../../models/MaterialType/materialType");
const Material = require("../../models/Material/material");
const MachineType = require("../../models/MachineType/MachineType");
const Machine = require("../../models/Machine/Machine");
const MachineOperator = require("../../models/MachineOperator/MachineOperator");
const Step = require("../../models/steps/step");
const connectDB = require("../../config/mongodb/db");

/**
 * Get all form data for creating an order in ONE API call
 * This prevents multiple API calls and improves performance
 *
 * Route: GET /order/form-data
 */
const getOrderFormData = async (event, context) => {
  // Prevent Lambda from waiting for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // ✅ CRITICAL: Connect to database BEFORE running queries
    await connectDB();

    const branchId = event.queryStringParameters?.branchId;

    if (!branchId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          success: false,
          message: "Branch ID is required"
        })
      };
    }

    console.log("📊 Fetching order form data for branchId:", branchId);

    // We'll create an array of promises for all the queries
    const promises = [
      // ✅ FIXED: Added all necessary customer fields
      Account.find({ branchId })
        .select("_id accountName accountId firstName lastName companyName company phoneNumber phone1 phone telephone mobile email whatsapp address address1 address2 state pinCode imageUrl")
        .lean(),
      ProductType.find({ branchId })
        .select("productTypeName description")
        .lean(),
      Product.find({ branchId })
        .populate("productType", "productTypeName")
        .select("productName productType")
        .lean(),
      ProductSpec.find({ branchId, isActive: true })
        .populate("productTypeId", "productTypeName")
        .select("specName description dimensions productTypeId")
        .lean(),
      MaterialType.find({ branchId })
        .select("materialTypeName description")
        .lean(),
      Material.find({ branchId })
        .populate("materialType", "materialTypeName")
        .select("materialName materialType")
        .lean(),
      MachineType.find({ branchId })
        .select("type description")
        .lean(),
      Machine.find({ branchId })
        .populate("machineType", "type")
        .select("machineName machineId machineType")
        .lean(),
      MachineOperator.find({ branchId })
        .select("operatorName operatorId phoneNumber")
        .lean(),
      Step.find({ branchId })
        .select("stepName machines branchId")
        .lean()
    ];

    // We'll use allSettled to wait for all promises to complete
    const results = await Promise.allSettled(promises);

    // Now, we extract the data from each result, or set to empty array if rejected
    const [
      customers,
      productTypes,
      products,
      productSpecs,
      materialTypes,
      materials,
      machineTypes,
      machines,
      operators,
      steps
    ] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Query ${index} succeeded with ${result.value.length} items`);
        return result.value;
      } else {
        console.error(`❌ Query ${index} failed:`, result.reason.message);
        return [];
      }
    });

    console.log("✅ All queries completed, sending response...");
    console.log(`📊 Customers loaded: ${customers.length} with fields:`, customers[0] ? Object.keys(customers[0]) : 'none');

    // Return the response in Lambda format
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        data: {
          customers,
          productTypes,
          products,
          productSpecs,
          materialTypes,
          materials,
          machineTypes,
          machines,
          operators,
          steps
        },
        meta: {
          counts: {
            customers: customers.length,
            productTypes: productTypes.length,
            products: products.length,
            productSpecs: productSpecs.length,
            materialTypes: materialTypes.length,
            materials: materials.length,
            machineTypes: machineTypes.length,
            machines: machines.length,
            operators: operators.length,
            steps: steps.length
          },
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error("❌ FATAL Error fetching order form data:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: false,
        message: "Failed to fetch order form data",
        error: error.message,
        stack: error.stack
      })
    };
  }
};

/**
 * Get products and specs for a specific product type
 * Used when user selects a product type in the form
 *
 * Route: GET /order/product-type-data/{id}
 */
const getProductTypeData = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    const productTypeId = event.pathParameters?.id;

    if (!productTypeId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          success: false,
          message: "Product Type ID is required"
        })
      };
    }

    // Fetch products and specs for this product type in parallel
    const [products, productSpecs] = await Promise.all([
      Product.find({ productType: productTypeId })
        .populate("productType", "productTypeName")
        .select("productName productType sizeX sizeY sizeZ")
        .lean(),

      ProductSpec.find({ productTypeId, isActive: true })
        .select("specName description dimensions")
        .lean()
    ]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        data: {
          products,
          productSpecs
        }
      })
    };

  } catch (error) {
    console.error("Error fetching product type data:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: false,
        message: "Failed to fetch product type data",
        error: error.message
      })
    };
  }
};

/**
 * Get materials for a specific material type
 * Used when user selects a material type in the form
 *
 * Route: GET /order/material-type-data/{id}
 */
const getMaterialTypeData = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    const materialTypeId = event.pathParameters?.id;

    if (!materialTypeId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          success: false,
          message: "Material Type ID is required"
        })
      };
    }

    const materials = await Material.find({ materialType: materialTypeId })
      .populate("materialType", "materialTypeName")
      .select("materialName materialType density price")
      .lean();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        data: {
          materials
        }
      })
    };

  } catch (error) {
    console.error("Error fetching material type data:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: false,
        message: "Failed to fetch material type data",
        error: error.message
      })
    };
  }
};

module.exports = {
  getOrderFormData,
  getProductTypeData,
  getMaterialTypeData
};