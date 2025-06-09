const jwt = require('jsonwebtoken');
require('dotenv').config();

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

module.exports = verifyToken;