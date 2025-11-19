const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import models for session validation
const Admin = require('../models/Admin/Admin');
const Manager = require('../models/Manager/Mannager');
const MasterAdmin = require('../models/masterAdmin/masterAdmin');

/**
 * Verifies a JWT token from the Authorization header.
 * @param {string} authHeader - The Authorization header ("Bearer <token>")
 * @returns {object} - Decoded token payload (e.g., { id, role, branchId })
 * @throws {Error} - If token is missing or invalid
 */
const verifyToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Verifies a JWT token and validates the session token against the database.
 * This ensures single-device login - when user logs in on new device, old sessions are invalidated.
 * @param {string} authHeader - The Authorization header ("Bearer <token>")
 * @returns {object} - Decoded token payload
 * @throws {Error} - If token is invalid or session is no longer active
 */
const verifyTokenWithSession = async (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    throw new Error('Invalid or expired token');
  }

  // If no session token in JWT, use basic verification (backward compatibility)
  if (!decoded.sessionToken) {
    return decoded;
  }

  // Validate session token against database
  let user;
  let storedSessionToken;

  try {
    if (decoded.role === 'admin') {
      user = await Admin.findById(decoded.id).select('activeSessionToken');
      storedSessionToken = user?.activeSessionToken;
    } else if (decoded.role === 'manager' || decoded.role === 'Manager') {
      user = await Manager.findById(decoded.id).select('activeSessionToken');
      storedSessionToken = user?.activeSessionToken;
    } else if (decoded.role === 'master_admin') {
      user = await MasterAdmin.findById(decoded.id).select('sessionToken');
      storedSessionToken = user?.sessionToken;
    }

    if (!user) {
      throw new Error('User not found');
    }

    // Check if session token matches (single-device enforcement)
    if (storedSessionToken && decoded.sessionToken !== storedSessionToken) {
      throw new Error('Session expired. You have been logged out because you logged in on another device.');
    }

    return decoded;
  } catch (err) {
    if (err.message.includes('Session expired') || err.message.includes('User not found')) {
      throw err;
    }
    console.error('Session validation error:', err.message);
    throw new Error('Session validation failed');
  }
};

module.exports = verifyToken;
module.exports.verifyTokenWithSession = verifyTokenWithSession;