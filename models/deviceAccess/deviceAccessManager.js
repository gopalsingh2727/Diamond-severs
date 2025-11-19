const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { z } = require('zod');

// Zod schema for creating DeviceAccessManager
const createDeviceAccessManagerSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required').trim(),
  location: z.string().min(1, 'Location is required').trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  product27InfinityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format').optional()
});

// Zod schema for updating DeviceAccessManager
const updateDeviceAccessManagerSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required').trim().optional(),
  location: z.string().min(1, 'Location is required').trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  product27InfinityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format').optional()
}).strict();

// Zod schema for device manager login
const deviceManagerLoginSchema = z.object({
  deviceName: z.string().min(1, 'Device name is required'),
  password: z.string().min(1, 'Password is required').optional(),
  pin: z.string().min(1, 'PIN is required').optional()
}).refine(data => data.password || data.pin, {
  message: 'Either password or PIN is required',
  path: ['password']
});

const deviceAccessManager = new mongoose.Schema(
  {
    deviceName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    pin: {
      type: String,
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
     product27InfinityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product27Infinity',
        required: false
      }
  },
  {
    timestamps: true,
  }
);


deviceAccessManager.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (this.isModified("pin")) {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
  }

  next();
});


deviceAccessManager.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

deviceAccessManager.methods.comparePin = async function (inputPin) {
  return await bcrypt.compare(inputPin, this.pin);
};

const DeviceAccessManager = mongoose.model("DeviceAccessManager", deviceAccessManager);

module.exports = DeviceAccessManager;
module.exports.createDeviceAccessManagerSchema = createDeviceAccessManagerSchema;
module.exports.updateDeviceAccessManagerSchema = updateDeviceAccessManagerSchema;
module.exports.deviceManagerLoginSchema = deviceManagerLoginSchema;