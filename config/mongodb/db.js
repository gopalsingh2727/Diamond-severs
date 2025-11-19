// db/connection.js
const mongoose = require("mongoose");
require("dotenv").config();

let isConnected = false;
let connectionPromise = null;

const MONGODB_OPTIONS = {
  maxPoolSize: 50,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  // Deprecated options removed (useNewUrlParser, useUnifiedTopology)
  // These have no effect since MongoDB Driver v4.0.0
};

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ Using existing database connection');
    return;
  }

  if (connectionPromise) {
    console.log('🔄 Connection in progress, waiting...');
    return connectionPromise;
  }

  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('🔄 Creating new database connection...');
      
      // Check if MONGO_URI is available
      if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not defined');
      }
      
      await mongoose.connect(process.env.MONGO_URI, MONGODB_OPTIONS);
      
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connected successfully');
        isConnected = true;
        resolve();
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        isConnected = false;
        connectionPromise = null;
        reject(err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        isConnected = false;
        connectionPromise = null;
      });

      // Resolve immediately since connection is established
      resolve();

    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      connectionPromise = null;
      isConnected = false;
      reject(error);
    }
  });

  return connectionPromise;
};

module.exports = connectDB;