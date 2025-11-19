const connect = require('../../config/mongodb/db');
const MasterAdmin = require('../../models/masterAdmin/masterAdmin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { withLogger } = require('../../middleware/logger');
const { cacheWrapper, cacheInvalidationHooks } = require('../../middleware/cacheMiddleware');
const { verifyTokenWithSession } = require('../../utiles/verifyToken');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  return apiKey === process.env.API_KEY;
};

const verifyMasterAdmin = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.role !== 'master_admin') {
    throw new Error('Master admin access required');
  }

  return decoded;
};

// Async version with session validation for single-device login
const verifyMasterAdminWithSession = async (authHeader) => {
  const decoded = await verifyTokenWithSession(authHeader);

  if (decoded.role !== 'master_admin') {
    throw new Error('Master admin access required');
  }

  return decoded;
};

/**
 * Master Admin Login
 * POST /master-admin/login
 */
module.exports.loginMasterAdmin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return respond(400, { message: 'Username and password are required' });
    }

    // Find and validate credentials
    const admin = await MasterAdmin.findByCredentials(username, password);

    // Generate unique session token for single-device login
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Update last login and session token
    admin.lastLogin = new Date();
    admin.sessionToken = sessionToken;
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions,
        sessionToken: sessionToken // Include session token in JWT
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('Master admin logged in', {
      adminId: admin._id,
      username: admin.username,
    });

    return respond(200, {
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions,
      },
    });
  } catch (err) {
    logger.error('Master admin login failed', { error: err.message });

    if (err.message === 'Account is locked. Please try again later.') {
      return respond(423, { message: err.message });
    }

    return respond(401, { message: err.message || 'Invalid credentials' });
  }
});

/**
 * Create Master Admin (Super Admin Only)
 * POST /master-admin/create
 */
module.exports.createMasterAdmin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    // Only super admin can create other master admins
    if (!currentAdmin.isSuperAdmin) {
      return respond(403, { message: 'Only super admin can create master admins' });
    }

    const { username, email, password, fullName, phone, isSuperAdmin, permissions } = JSON.parse(
      event.body
    );

    // Validation
    if (!username || !email || !password || !fullName) {
      return respond(400, {
        message: 'Username, email, password, and full name are required',
      });
    }

    // Check if username or email already exists
    const existingAdmin = await MasterAdmin.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      return respond(400, { message: 'Username or email already exists' });
    }

    // Create new master admin
    const admin = new MasterAdmin({
      username,
      email,
      password,
      fullName,
      phone,
      isSuperAdmin: isSuperAdmin || false,
      permissions: permissions || undefined, // Use default if not provided
      createdBy: currentAdmin.id,
    });

    await admin.save();

    logger.info('Master admin created', {
      adminId: admin._id,
      createdBy: currentAdmin.id,
    });

    return respond(201, {
      message: 'Master admin created successfully',
      admin: admin.toJSON(),
    });
  } catch (err) {
    logger.error('Create master admin error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get All Master Admins
 * GET /master-admin/all
 */
module.exports.getAllMasterAdmins = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    const { page = 1, limit = 50, isActive, isSuperAdmin } = event.queryStringParameters || {};

    // Build filter
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isSuperAdmin !== undefined) filter.isSuperAdmin = isSuperAdmin === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [admins, total] = await Promise.all([
      MasterAdmin.find(filter)
        .select('-password -twoFactorSecret -passwordResetToken -sessionToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MasterAdmin.countDocuments(filter),
    ]);

    return respond(200, {
      admins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Get all master admins error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get Master Admin by ID
 * GET /master-admin/{id}
 */
module.exports.getMasterAdminById = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    const { id } = event.pathParameters;

    const admin = await MasterAdmin.findById(id)
      .select('-password -twoFactorSecret -passwordResetToken -sessionToken')
      .lean();

    if (!admin) {
      return respond(404, { message: 'Master admin not found' });
    }

    return respond(200, { admin });
  } catch (err) {
    logger.error('Get master admin error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Update Master Admin
 * PUT /master-admin/{id}
 */
module.exports.updateMasterAdmin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Find admin to update
    const admin = await MasterAdmin.findById(id);
    if (!admin) {
      return respond(404, { message: 'Master admin not found' });
    }

    // Only super admin can update other admins or change super admin status
    if (!currentAdmin.isSuperAdmin && currentAdmin.id !== id) {
      return respond(403, { message: 'Not authorized to update this admin' });
    }

    // Prevent changing super admin status unless current user is super admin
    if (updates.isSuperAdmin !== undefined && !currentAdmin.isSuperAdmin) {
      return respond(403, { message: 'Only super admin can change super admin status' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'fullName',
      'phone',
      'email',
      'isActive',
      'isSuperAdmin',
      'permissions',
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        admin[field] = updates[field];
      }
    });

    // Handle password update separately
    if (updates.password) {
      admin.password = updates.password;
    }

    admin.lastModifiedBy = currentAdmin.id;
    await admin.save();

    logger.info('Master admin updated', {
      adminId: id,
      updatedBy: currentAdmin.id,
    });

    return respond(200, {
      message: 'Master admin updated successfully',
      admin: admin.toJSON(),
    });
  } catch (err) {
    logger.error('Update master admin error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Delete/Deactivate Master Admin
 * DELETE /master-admin/{id}
 */
module.exports.deleteMasterAdmin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    // Only super admin can delete admins
    if (!currentAdmin.isSuperAdmin) {
      return respond(403, { message: 'Only super admin can delete master admins' });
    }

    const { id } = event.pathParameters;

    // Prevent self-deletion
    if (currentAdmin.id === id) {
      return respond(400, { message: 'Cannot delete your own account' });
    }

    const admin = await MasterAdmin.findById(id);
    if (!admin) {
      return respond(404, { message: 'Master admin not found' });
    }

    // Soft delete - just deactivate
    admin.isActive = false;
    admin.lastModifiedBy = currentAdmin.id;
    await admin.save();

    logger.info('Master admin deactivated', {
      adminId: id,
      deactivatedBy: currentAdmin.id,
    });

    return respond(200, { message: 'Master admin deactivated successfully' });
  } catch (err) {
    logger.error('Delete master admin error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Change Password
 * POST /master-admin/change-password
 */
module.exports.changeMasterAdminPassword = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const currentAdmin = verifyMasterAdmin(authHeader);

    const { currentPassword, newPassword } = JSON.parse(event.body);

    if (!currentPassword || !newPassword) {
      return respond(400, { message: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return respond(400, { message: 'New password must be at least 8 characters' });
    }

    const admin = await MasterAdmin.findById(currentAdmin.id);
    if (!admin) {
      return respond(404, { message: 'Admin not found' });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return respond(401, { message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    logger.info('Master admin password changed', { adminId: currentAdmin.id });

    return respond(200, { message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { error: err.message });
    return respond(500, { message: err.message });
  }
});

/**
 * Get Current Master Admin Info
 * GET /master-admin/me
 */
module.exports.getCurrentMasterAdmin = withLogger(async (event, context, logger) => {
  await connect();

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let currentAdmin;
    try {
      currentAdmin = await verifyMasterAdminWithSession(authHeader);
    } catch (err) {
      // Check if session expired due to login on another device
      if (err.message.includes('Session expired')) {
        return respond(401, { message: err.message, sessionExpired: true });
      }
      return respond(401, { message: err.message || 'Invalid token' });
    }

    const admin = await MasterAdmin.findById(currentAdmin.id)
      .select('-password -twoFactorSecret -passwordResetToken -sessionToken')
      .lean();

    if (!admin) {
      return respond(404, { message: 'Admin not found' });
    }

    return respond(200, { admin });
  } catch (err) {
    logger.error('Get current admin error', { error: err.message });
    return respond(500, { message: err.message });
  }
});
