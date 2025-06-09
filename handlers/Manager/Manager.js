const jwt = require('jsonwebtoken');
const connect = require('../../config/mongodb/db');
const Manager = require('../../models/Manager/Mannager');
const Branch = require('../../models/Branch/Branch'); // Ensure this exists
const  verifyToken  = require('../../utiles/verifyToken'); // Assumes you have this helper


module.exports.createManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Only admin can create managers' }) };
    }

    const { username, password, branchId } = JSON.parse(event.body);

    if (!username || !password || !branchId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'All fields are required' }) };
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Branch not found' }) };
    }

    const existing = await Manager.findOne({ username });
    if (existing) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Manager already exists' }) };
    }

    const manager = new Manager({ username, password, branchId });
    await manager.save();

    return { statusCode: 201, body: JSON.stringify({ message: 'Manager created successfully' }) };
  } catch (err) {
    console.error('Create Manager Error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};


module.exports.managerLogin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Username and password are required' }) };
    }

    const manager = await Manager.findOne({ username });
    if (!manager || !(await manager.comparePassword(password))) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials' }) };
    }

    const token = jwt.sign(
      {
        id: manager._id,
        username: manager.username,
        role: 'manager',
        branchId: manager.branchId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return { statusCode: 200, body: JSON.stringify({ token }) };
  } catch (err) {
    console.error('Manager Login Error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};



module.exports.getAllManagers = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Only admin can view managers' }) };
    }

    const managers = await Manager.find().populate('branchId', 'branchName location');

    const result = managers.map(mgr => ({
      id: mgr._id,
      username: mgr.username,
      // Do not expose password in production!
      branchName: mgr.branchId?.branchName || "Unknown",
      location: mgr.branchId?.location || "Unknown"
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('Get All Managers Error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

module.exports.updateManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Only admin can update managers' }) };
    }

    const { id, username, password, branchId } = JSON.parse(event.body);

    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Manager ID is required' }) };
    }

    const manager = await Manager.findById(id);
    if (!manager) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Manager not found' }) };
    }

    if (username) manager.username = username;
    if (password) manager.password = password; 
    if (branchId) manager.branchId = branchId;

    await manager.save();

    return { statusCode: 200, body: JSON.stringify({ message: 'Manager updated successfully' }) };
  } catch (err) {
    console.error('Update Manager Error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};

module.exports.getMyBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connect();

    // Extract and verify token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Authorization header missing' }),
      };
    }

    const user = verifyToken(authHeader);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid token' }),
      };
    }

    if (user.role !== 'manager') {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Only managers can access this route' }),
      };
    }

    if (!user.branchId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Branch ID missing in token' }),
      };
    }

    const branch = await Branch.findById(user.branchId).lean();

    if (!branch) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Branch not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        branchId: branch._id,
        name: branch.name,
        location: branch.location,
      }),
    };
  } catch (err) {
    console.error('Get My Branch Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};




module.exports.deleteManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);

    if (!user || user.role !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Only admin can delete managers' }) };
    }

    const { id } = JSON.parse(event.body);
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Manager ID is required' }) };
    }

    const result = await Manager.findByIdAndDelete(id);
    if (!result) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Manager not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Manager deleted successfully' }) };
  } catch (err) {
    console.error('Delete Manager Error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};