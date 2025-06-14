require('dotenv').config();
const jwt = require('jsonwebtoken');
const  connectDB  = require('../../config/mongodb/db');
const User = require('../../models/Admin/Admin');

// CREATE ADMIN (only once)
module.exports.createAdmin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false; // Avoid Lambda timeout

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Admin already exists' }),
      };
    }

    const { username, password } = JSON.parse(event.body);
    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username and password are required' }),
      };
    }

    const admin = new User({ username, password, role: 'admin' });
    await admin.save();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Admin created successfully' }),
    };

  } catch (error) {
    console.error('CreateAdmin error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
// ADMIN LOGIN
module.exports.loginAdmin = async (event) => {
  await connectDB();

  const { username, password } = JSON.parse(event.body);
  const admin = await User.findOne({ username, role: 'admin' });

  if (!admin || !(await admin.comparePassword(password))) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Invalid credentials' }),
    };
  }

  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ token }),
  };
};