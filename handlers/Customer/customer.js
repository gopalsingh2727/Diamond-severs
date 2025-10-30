

const Customer = require('../../models/Customer/customer');
const verifyToken = require('../../utiles/verifyToken'); 
const connect = require('../../config/mongodb/db');
const uploadImageToFirebase = require('../../firebase/firebaseConfig')

const { parse } = require('lambda-multipart-parser');
const fs = require('fs');
const path = require("path");








module.exports.createCustomer = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = event.headers || {};
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
   
    await connect();

    // API Key validation
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


    let data = {};
    let imageFile = null;
    const contentType = headers["content-type"] || headers["Content-Type"] || "";
    
    console.log("Content-Type:", contentType);
    console.log("Is multipart:", contentType.includes("multipart/form-data"));
    console.log("Raw event body:", event.body);

    if (contentType.includes("multipart/form-data")) {
      try {
        const result = await parse(event);
        console.log("Parsed multipart result:", JSON.stringify(result, null, 2));
        
        // FIXED: Handle parser that only extracts files but not form fields
        // Check if form data is embedded within the files array
        if (result.files && Array.isArray(result.files)) {
          // Look for text fields that might be mixed with files
          result.files.forEach(item => {
            if (item.fieldname && !item.filename && item.content) {
              // This is likely a text field stored as a "file"
              try {
                data[item.fieldname] = item.content.toString('utf8');
              } catch (e) {
                data[item.fieldname] = item.content;
              }
            } else if (item.fieldname && item.value !== undefined) {
              // Some parsers store text fields with a 'value' property
              data[item.fieldname] = item.value;
            }
          });
          
          // Find actual image file
          imageFile = result.files.find(f => f.filename && f.contentType && f.contentType.startsWith('image/'));
        }
        
        // Check other possible structures
        if (Object.keys(data).length === 0) {
          if (result.fields) {
            data = result.fields;
          } else if (result.body && result.body.fields) {
            data = result.body.fields;
          } else if (result.form) {
            data = result.form;
          } else {
            // Try to extract from root level, excluding known file properties
            Object.keys(result).forEach(key => {
              if (!['files', 'file'].includes(key) && typeof result[key] !== 'object') {
                data[key] = result[key];
              }
            });
          }
        }
        
        // Convert single-item arrays to strings (common with multipart parsers)
        Object.keys(data).forEach(key => {
          if (Array.isArray(data[key]) && data[key].length === 1) {
            data[key] = data[key][0];
          }
        });
        
        console.log("Processed form data:", JSON.stringify(data, null, 2));
        console.log("Image file found:", !!imageFile);

        // If we still don't have form data, provide detailed debugging
        if (Object.keys(data).length === 0) {
          console.error("No form fields found in parsed result");
          
          // Log detailed structure of files array for debugging
          if (result.files) {
            console.log("Files array structure:");
            result.files.forEach((file, index) => {
              console.log(`File ${index}:`, {
                fieldname: file.fieldname,
                filename: file.filename,
                contentType: file.contentType,
                hasContent: !!file.content,
                contentLength: file.content ? file.content.length : 0,
                otherProps: Object.keys(file).filter(k => !['fieldname', 'filename', 'contentType', 'content'].includes(k))
              });
            });
          }
          
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
              message: "No form fields found in multipart data. Check if your client is sending form fields correctly.",
              debugInfo: {
                resultKeys: Object.keys(result),
                hasFields: !!result.fields,
                hasBodyFields: !!(result.body && result.body.fields),
                hasForm: !!result.form,
                filesCount: result.files ? result.files.length : 0,
                fileStructure: result.files ? result.files.map(f => ({
                  fieldname: f.fieldname,
                  filename: f.filename,
                  hasContent: !!f.content,
                  contentType: f.contentType
                })) : []
              }
            }),
          };
        }
        
      } catch (parseError) {
        console.error("Multipart parsing error:", parseError);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: "Failed to parse multipart form data",
            error: parseError.message 
          }),
        };
      }
    } else {
      // Ensure event.body exists and is not empty
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Request body is required" }),
        };
      }
      
      try {
        data = JSON.parse(event.body);
        console.log("Parsed JSON data:", JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error("JSON parsing error:", parseError);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid JSON in request body" }),
        };
      }
    }

    // Validate required fields
    const requiredFields = ["firstName", "lastName", "phone1", "address1", "state", "pinCode"];
    console.log("Validating required fields...");
    console.log("Available data keys:", Object.keys(data));
    
    for (const field of requiredFields) {
      console.log(`Checking field '${field}':`, data[field]);
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        console.error(`Missing or empty required field: ${field}`);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: `Missing required field: ${field}`,
            receivedFields: Object.keys(data),
            fieldValue: data[field],
            allData: data // ADDED: Include all data for debugging
          }),
        };
      }
    }

    // Create customer object
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

    // Handle image upload from multipart form data
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
    } 
    // Handle base64 image upload
    else if (data.imageBase64 && data.imageName) {
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

    // Save customer to database
    await customer.save();

    // Clean up temporary file
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

    // Handle different types of errors
    const isDuplicate = err.code === 11000;
    const statusCode = isDuplicate ? 400 : 500;
    const message = isDuplicate ? "Duplicate entry" : (err.message || "Internal server error");

    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ message }),
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