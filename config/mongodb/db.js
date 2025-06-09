const mongoose = require("mongoose");
require('dotenv').config();

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return; // already connected or connecting
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw new Error("Database connection failed");
  }
};

module.exports = connectDB;