

const Customer = require('../../models/Customer/customer');
const verifyToken = require('../../utiles/verifyToken'); 
const connect = require('../../config/mongodb/db');
const uploadImageToFirebase = require('../../firebase/firebaseConfig')

const { parse } = require('lambda-multipart-parser');
const fs = require('fs');
const path = require("path");
const fs = require("fs");
const path = require("path");




const { parse } = require("./utils/multipartParser");
const { uploadImageToFirebase } = require("./utils/uploadToFirebase");

module.exports.createCustomer = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  await connect();

  try {
    // Validate API Key
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    const authHeader = headers.authorization || headers.Authorization;
    const user = await verifyToken(authHeader);

    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Only admin or manager can create customers" }),
      };
    }

    let data;
    let imageFile = null;
    const contentType = headers["content-type"] || headers["Content-Type"] || "";

    if (contentType.includes("multipart/form-data")) {
      const result = await parse(event);
      data = result.fields || {};
      if (result.files?.length > 0) {
        imageFile = result.files.find((f) => f.fieldname === "image");
      }
    } else {
      data = JSON.parse(event.body);
    }

    const requiredFields = ["firstName", "lastName", "phone1", "address1", "state", "pinCode"];
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: `Missing required field: ${field}` }),
        };
      }
    }

    const customer = new Customer({
      companyName: data.companyName,
      firstName: data.firstName,
      lastName: data.lastName,
      phone1: data.phone1,
      phone2: data.phone2,
      whatsapp: data.whatsapp,
      telephone: data.telephone,
      address1: data.address1,
      address2: data.address2,
      state: data.state,
      pinCode: data.pinCode,
      email: data.email,
      branchId: data.branchId || user.branchId,
    });

    let tmpFilePath;

    if (imageFile?.content) {
      const ext = path.extname(imageFile.filename).toLowerCase();
      const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
      if (!allowedTypes.includes(ext)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unsupported image type" }),
        };
      }

      tmpFilePath = `/tmp/${imageFile.filename}`;
      fs.writeFileSync(tmpFilePath, imageFile.content);
      const firebaseUrl = await uploadImageToFirebase(tmpFilePath, imageFile.filename);
      customer.imageUrl = firebaseUrl;
    } else if (data.imageBase64 && data.imageName) {
      const ext = path.extname(data.imageName).toLowerCase();
      const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
      if (!allowedTypes.includes(ext)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unsupported image file extension" }),
        };
      }

      tmpFilePath = `/tmp/${data.imageName}`;
      const buffer = Buffer.from(data.imageBase64, "base64");
      fs.writeFileSync(tmpFilePath, buffer);
      const firebaseUrl = await uploadImageToFirebase(tmpFilePath, data.imageName);
      customer.imageUrl = firebaseUrl;
    }

    await customer.save();

    if (tmpFilePath) {
      try {
        fs.unlinkSync(tmpFilePath);
      } catch (cleanupErr) {
        console.warn("Temp file cleanup failed:", cleanupErr.message);
      }
    }

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Customer created successfully", customer }),
    };
  } catch (err) {
    console.error("Error creating customer:", err);

    const isDuplicate = err.code === 11000;
    return {
      statusCode: isDuplicate ? 400 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: isDuplicate ? "Duplicate entry" : err.message }),
    };
  }
};


module.exports.getCustomers = async (event) => {
  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  await connect();

  try {
    // ✅ API key validation
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    // 🔐 Admin/Manager check
    const authHeader = headers.authorization || headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin or manager can view customers' }),
      };
    }

    // ✅ Filter by branch if manager
    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    // ⚠️ Consider pagination for large datasets
    const customers = await Customer.find(filter).sort({ createdAt: -1 });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(customers),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message }),
    };
  }
};


module.exports.updateCustomer = async (event) => {
  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  await connect();

  try {
    // 🔐 API Key Validation
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    const authHeader = headers.authorization || headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin or manager can update customers' }),
      };
    }

    const { id } = event.pathParameters || {};
    const data = JSON.parse(event.body);

    const customer = await Customer.findById(id);
    if (!customer) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Customer not found' }),
      };
    }

    if (user.role === 'manager' && String(customer.branchId) !== user.branchId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Manager can only update their branch customers' }),
      };
    }

    // ✅ Safer field update
    const updatableFields = [
      'companyName', 'firstName', 'lastName', 'phone1', 'phone2',
      'whatsapp', 'telephone', 'address1', 'address2',
      'state', 'pinCode', 'email'
    ];

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        customer[field] = data[field];
      }
    }

    await customer.save();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Customer updated', customer }),
    };
  } catch (err) {
    const headersWithError = { ...corsHeaders };
    if (err.code === 11000) {
      return {
        statusCode: 400,
        headers: headersWithError,
        body: JSON.stringify({ message: 'Company name must be unique in branch' }),
      };
    }

    return {
      statusCode: 500,
      headers: headersWithError,
      body: JSON.stringify({ message: err.message || "Server Error" }),
    };
  }
};

module.exports.deleteCustomer = async (event) => {
  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  // 🌐 Handle CORS preflight request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  await connect();

  try {
    // 🔐 API key validation
    const apiKey = headers["x-api-key"] || headers["X-API-Key"];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Forbidden: Invalid API key" }),
      };
    }

    const authHeader = headers.authorization || headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Only admin or manager can delete customers' }),
      };
    }

    const { id } = event.pathParameters || {};
    const customer = await Customer.findById(id);

    if (!customer) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Customer not found' }),
      };
    }

    if (user.role === 'manager' && String(customer.branchId) !== user.branchId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Manager can only delete their branch customers' }),
      };
    }

    await Customer.findByIdAndDelete(id);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Customer deleted' }),
    };
  } catch (err) {
    console.error("Error deleting customer:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: err.message || "Server error" }),
    };
  }
};