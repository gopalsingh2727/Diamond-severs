const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return; // Already connected or connecting
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw new Error("Database connection failed");
  }
};

module.exports = connectDB;