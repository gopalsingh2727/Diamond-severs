// config/mongodb/connections.js
const mongoose = require("mongoose");
require("dotenv").config();

/**
 * Multiple Database Connection Manager
 *
 * This module manages separate MongoDB connections for different parts of the application:
 * - Main Database: For regular operations (Branch, Customer, Order, etc.)
 * - MasterAdmin Database: For MasterAdmin operations
 *
 * Usage:
 * const { getMainConnection, getMasterAdminConnection } = require('./config/mongodb/connections');
 *
 * const mainDb = await getMainConnection();
 * const masterAdminDb = await getMasterAdminConnection();
 */

// Connection cache
let mainConnection = null;
let masterAdminConnection = null;

// Connection promises to prevent multiple simultaneous connection attempts
let mainConnectionPromise = null;
let masterAdminConnectionPromise = null;

const MONGODB_OPTIONS = {
  maxPoolSize: 50,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  // Deprecated options removed (useNewUrlParser, useUnifiedTopology)
  // These have no effect since MongoDB Driver v4.0.0
};

/**
 * Get Main Database Connection
 * Used for regular operations: Branch, Customer, Order, Machine, etc.
 */
const getMainConnection = async () => {
  // If connection exists and is ready, return it
  if (mainConnection && mainConnection.readyState === 1) {
    console.log('✅ Using existing MAIN database connection');
    return mainConnection;
  }

  // If connection is in progress, wait for it
  if (mainConnectionPromise) {
    console.log('🔄 MAIN connection in progress, waiting...');
    return mainConnectionPromise;
  }

  // Create new connection
  mainConnectionPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('🔄 Creating new MAIN database connection...');

      // Check if MONGO_URI is available
      if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not defined');
      }

      // Create connection using mongoose.createConnection (not mongoose.connect)
      mainConnection = mongoose.createConnection(process.env.MONGO_URI, MONGODB_OPTIONS);

      mainConnection.on('connected', () => {
        console.log('✅ MAIN MongoDB connected successfully');
      });

      mainConnection.on('error', (err) => {
        console.error('❌ MAIN MongoDB connection error:', err);
        mainConnection = null;
        mainConnectionPromise = null;
      });

      mainConnection.on('disconnected', () => {
        console.log('⚠️ MAIN MongoDB disconnected');
        mainConnection = null;
        mainConnectionPromise = null;
      });

      // Wait for connection to be ready
      await mainConnection.asPromise();

      resolve(mainConnection);

    } catch (error) {
      console.error('❌ Failed to connect to MAIN MongoDB:', error);
      mainConnectionPromise = null;
      mainConnection = null;
      reject(error);
    }
  });

  return mainConnectionPromise;
};

/**
 * Get MasterAdmin Database Connection
 * Used for MasterAdmin operations only
 */
const getMasterAdminConnection = async () => {
  // If connection exists and is ready, return it
  if (masterAdminConnection && masterAdminConnection.readyState === 1) {
    console.log('✅ Using existing MASTER_ADMIN database connection');
    return masterAdminConnection;
  }

  // If connection is in progress, wait for it
  if (masterAdminConnectionPromise) {
    console.log('🔄 MASTER_ADMIN connection in progress, waiting...');
    return masterAdminConnectionPromise;
  }

  // Create new connection
  masterAdminConnectionPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('🔄 Creating new MASTER_ADMIN database connection...');

      // Check if MASTER_ADMIN_MONGO_URI is available
      // If not available, fall back to main database
      const masterAdminUri = process.env.MASTER_ADMIN_MONGO_URI || process.env.MONGO_URI;

      if (!masterAdminUri) {
        throw new Error('Neither MASTER_ADMIN_MONGO_URI nor MONGO_URI environment variable is defined');
      }

      // Create separate connection for MasterAdmin
      masterAdminConnection = mongoose.createConnection(masterAdminUri, MONGODB_OPTIONS);

      masterAdminConnection.on('connected', () => {
        console.log('✅ MASTER_ADMIN MongoDB connected successfully');
      });

      masterAdminConnection.on('error', (err) => {
        console.error('❌ MASTER_ADMIN MongoDB connection error:', err);
        masterAdminConnection = null;
        masterAdminConnectionPromise = null;
      });

      masterAdminConnection.on('disconnected', () => {
        console.log('⚠️ MASTER_ADMIN MongoDB disconnected');
        masterAdminConnection = null;
        masterAdminConnectionPromise = null;
      });

      // Wait for connection to be ready
      await masterAdminConnection.asPromise();

      resolve(masterAdminConnection);

    } catch (error) {
      console.error('❌ Failed to connect to MASTER_ADMIN MongoDB:', error);
      masterAdminConnectionPromise = null;
      masterAdminConnection = null;
      reject(error);
    }
  });

  return masterAdminConnectionPromise;
};

/**
 * Close all database connections
 * Useful for graceful shutdown
 */
const closeAllConnections = async () => {
  try {
    if (mainConnection) {
      await mainConnection.close();
      console.log('✅ MAIN database connection closed');
      mainConnection = null;
      mainConnectionPromise = null;
    }

    if (masterAdminConnection) {
      await masterAdminConnection.close();
      console.log('✅ MASTER_ADMIN database connection closed');
      masterAdminConnection = null;
      masterAdminConnectionPromise = null;
    }
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

/**
 * Get connection by type
 * @param {string} type - 'main' or 'masteradmin'
 */
const getConnection = async (type = 'main') => {
  if (type === 'masteradmin' || type === 'master_admin') {
    return getMasterAdminConnection();
  }
  return getMainConnection();
};

module.exports = {
  getMainConnection,
  getMasterAdminConnection,
  getConnection,
  closeAllConnections,
};
