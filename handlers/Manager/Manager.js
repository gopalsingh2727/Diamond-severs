const jwt = require('jsonwebtoken');
const connect = require('../../config/mongodb/db');
const Manager = require('../../models/Manager/Mannager');
const Branch = require('../../models/Branch/Branch');
const verifyToken = require('../../utiles/verifyToken');
const mongoose = require('mongoose');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};

module.exports.createManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Only admin can create managers' });
    }

    const { username, password, branchId } = JSON.parse(event.body);
    if (!username || !password || !branchId) {
      return respond(400, { message: 'All fields are required' });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return respond(400, { message: 'Branch not found' });
    }

    const existing = await Manager.findOne({ username });
    if (existing) {
      return respond(400, { message: 'Manager already exists' });
    }

    const manager = new Manager({ username, password, branchId });
    await manager.save();

    const token = jwt.sign({
      id: manager._id,
      username: manager.username,
      role: 'manager',
      branchId: manager.branchId,
    }, process.env.JWT_SECRET, { expiresIn: '1d' });

    return respond(200, { token });
  } catch (err) {
    console.error('Create Manager Error:', err);
    return respond(500, { message: err.message });
  }
};

module.exports.managerLogin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { username, password } = JSON.parse(event.body);
    if (!username || !password) {
      return respond(400, { message: 'Username and password are required' });
    }

    const manager = await Manager.findOne({ username });
    if (!manager || !(await manager.comparePassword(password))) {
      return respond(401, { message: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: manager._id,
      username: manager.username,
      role: 'manager',
      branchId: manager.branchId,
    }, process.env.JWT_SECRET, { expiresIn: '1d' });

    return respond(200, { token });
  } catch (err) {
    console.error('Manager Login Error:', err);
    return respond(500, { message: err.message });
  }
};

module.exports.getAllManagers = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Only admin can view managers' });
    }

    const managers = await Manager.find().populate('branchId', 'branchName location');

    const result = managers.map(mgr => ({
      id: mgr._id,
      username: mgr.username,
      branchName: mgr.branchId?.branchName || 'Unknown',
      location: mgr.branchId?.location || 'Unknown',
    }));

    return respond(200, result);
  } catch (err) {
    console.error('Get All Managers Error:', err);
    return respond(500, { message: err.message });
  }
};

module.exports.updateManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Only admin can update managers' });
    }

    const { id, username, password, branchId } = JSON.parse(event.body);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid Manager ID' });
    }

    const manager = await Manager.findById(id);
    if (!manager) {
      return respond(404, { message: 'Manager not found' });
    }

    if (username) manager.username = username;
    if (password) manager.password = password;
    if (branchId) manager.branchId = branchId;

    await manager.save();
    return respond(200, { message: 'Manager updated successfully' });
  } catch (err) {
    console.error('Update Manager Error:', err);
    return respond(500, { message: err.message });
  }
};

module.exports.getMyBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (user.role !== 'manager') {
      return respond(403, { message: 'Only managers can access this route' });
    }

    if (!user.branchId) {
      return respond(400, { message: 'Branch ID missing in token' });
    }

    const branch = await Branch.findById(user.branchId).lean();
    if (!branch) {
      return respond(404, { message: 'Branch not found' });
    }

    return respond(200, {
      branchId: branch._id,
      name: branch.name,
      location: branch.location,
    });
  } catch (err) {
    console.error('Get My Branch Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

module.exports.deleteManager = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = verifyToken(authHeader);
    } catch {
      return respond(401, { message: 'Invalid token' });
    }

    if (!user || user.role !== 'admin') {
      return respond(403, { message: 'Only admin can delete managers' });
    }

    const { id } = JSON.parse(event.body);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return respond(400, { message: 'Invalid Manager ID' });
    }

    const result = await Manager.findByIdAndDelete(id);
    if (!result) {
      return respond(404, { message: 'Manager not found' });
    }

    return respond(200, { message: 'Manager deleted successfully' });
  } catch (err) {
    console.error('Delete Manager Error:', err);
    return respond(500, { message: err.message });
  }
};