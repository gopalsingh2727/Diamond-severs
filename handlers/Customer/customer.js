

const Customer = require('../../models/Customer/customer');
const verifyToken = require('../../utiles/verifyToken'); 
const connect = require('../../config/mongodb/db');
const uploadImageToFirebase = require('../../firebase/firebaseConfig')

const { parse } = require('lambda-multipart-parser');
const fs = require('fs');
const path = require("path");
module.exports.createCustomer = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await verifyToken(authHeader);

    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Only admin or manager can create customers" }),
      };
    }

    let data;
    let imageFile = null;

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";

    if (contentType.includes("multipart/form-data")) {
      const result = await parse(event);
      data = result.fields || {};
      if (result.files && result.files.length > 0) {
        imageFile = result.files.find((file) => file.fieldname === "image");
      }
    } else {
      data = JSON.parse(event.body);
    }

    const requiredFields = ["firstName", "lastName", "phone1", "address1", "state", "pinCode"];
    for (const field of requiredFields) {
      if (!data[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `${field} is required` }),
        };
      }
    }

    const customer = new Customer({
      companyName: data.companyName || undefined,
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
    console.log(customer);
    
    await customer.save();

   
    if (imageFile && imageFile.content) {
      const ext = path.extname(imageFile.filename).toLowerCase();
      const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
      if (!allowedTypes.includes(ext)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Unsupported image type" }),
        };
      }

      const tmpFilePath = `/tmp/${imageFile.filename}`;
      fs.writeFileSync(tmpFilePath, imageFile.content);
      const firebaseUrl = await uploadImageToFirebase(tmpFilePath, imageFile.filename);

      customer.imageUrl = firebaseUrl;
      await customer.save();
      fs.unlinkSync(tmpFilePath);
    } else if (data.imageBase64 && data.imageName) {
      const buffer = Buffer.from(data.imageBase64, "base64");
      const tmpFilePath = `/tmp/${data.imageName}`;
      fs.writeFileSync(tmpFilePath, buffer);
      const firebaseUrl = await uploadImageToFirebase(tmpFilePath, data.imageName);

      customer.imageUrl = firebaseUrl;
      await customer.save();
      fs.unlinkSync(tmpFilePath);
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Customer created successfully", customer }),
    };
  } catch (err) {
    console.error("Error creating customer:", err);

    if (err.code === 11000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Company name must be unique within the branch" }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message || "Server Error" }),
    };
  }
};


module.exports.getCustomers = async (event) => {
  await connect();
  try {
     const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only admin or manager can view customers' }),
      };
    }

    const filter = user.role === 'manager' ? { branchId: user.branchId } : {};

    const customers = await Customer.find(filter).sort({ createdAt: -1 });

    return {
      statusCode: 200,
      body: JSON.stringify(customers),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};


module.exports.updateCustomer = async (event) => {
  await connect();
  try {
    const { authorization } = event.headers;
    const user = verifyToken(authorization);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only admin or manager can update customers' }),
      };
    }

    const { id } = event.pathParameters;
    const data = JSON.parse(event.body);

    const customer = await Customer.findById(id);
    if (!customer) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Customer not found' }),
      };
    }

    if (user.role === 'manager' && String(customer.branchId) !== user.branchId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Manager can only update their branch customers' }),
      };
    }

    Object.assign(customer, data);
    await customer.save();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Customer updated', customer }),
    };
  } catch (err) {
    if (err.code === 11000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Company name must be unique in branch' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};


module.exports.deleteCustomer = async (event) => {
  await connect();
  try {
    const { authorization } = event.headers;
    const user = verifyToken(authorization);

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only admin or manager can delete customers' }),
      };
    }

    const { id } = event.pathParameters;
    const customer = await Customer.findById(id);

    if (!customer) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Customer not found' }),
      };
    }

    if (user.role === 'manager' && String(customer.branchId) !== user.branchId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Manager can only delete their branch customers' }),
      };
    }

    await Customer.findByIdAndDelete(id);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Customer deleted' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};