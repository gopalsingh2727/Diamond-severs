const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { z } = require('zod');

// Zod schema for machine item in device
const deviceMachineItemZodSchema = z.object({
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format'),
  machineName: z.string().min(1, 'Machine name is required'),
  machineType: z.string().optional(),
  addedAt: z.date().optional()
});

// Zod schema for creating DeviceAccess
const createDeviceAccessSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required').trim(),
  deviceName: z.string().min(1, 'Device name is required').trim(),
  location: z.string().min(1, 'Location is required').trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  product27InfinityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format').optional(),
  machines: z.array(deviceMachineItemZodSchema).optional()
});

// Zod schema for updating DeviceAccess
const updateDeviceAccessSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required').trim().optional(),
  deviceName: z.string().min(1, 'Device name is required').trim().optional(),
  location: z.string().min(1, 'Location is required').trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  product27InfinityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product27InfinityId format').optional(),
  machines: z.array(deviceMachineItemZodSchema).optional()
}).strict();

// Zod schema for device login
const deviceLoginSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  password: z.string().min(1, 'Password is required')
});

const deviceAccessSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
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
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    product27InfinityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product27Infinity',
      required: false
    },
    machines: [{
      machineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Machine",
        required: true
      },
      machineName: {
        type: String,
        required: true
      },
      machineType: {
        type: String,
        required: false
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
  }
);

// ─── Generate Unique Device ID ───────────────
deviceAccessSchema.statics.generateDeviceId = async function(branchIdOrName) {
  let branchName;
  
  // If it's an ObjectId, fetch the branch from database
  if (mongoose.Types.ObjectId.isValid(branchIdOrName)) {
    // Dynamically get Branch model to avoid circular dependency
    const Branch = mongoose.models.Branch || mongoose.model('Branch');
    const branch = await Branch.findById(branchIdOrName);
    
    if (!branch) {
      throw new Error('Branch not found');
    }
    branchName = branch.name || branch.branchName || 'DEV';
  } else {
    // It's already a branch name string
    branchName = branchIdOrName;
  }
  
  // Extract first 3 letters of branch name (uppercase)
  const branchPrefix = branchName
    .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X'); // If less than 3 chars, pad with 'X'
  
  // Generate 6 random numbers
  const randomNumbers = Math.floor(100000 + Math.random() * 900000);
  
  // Get current date in DDMMYY format
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const dateString = `${day}${month}${year}`;
  
  // Combine: BRANCH-XXXXXX-DDMMYY
  let deviceId = `${branchPrefix}-${randomNumbers}-${dateString}`;
  
  // Check for uniqueness and regenerate if exists
  let exists = await this.findOne({ deviceId });
  let attempts = 0;
  const maxAttempts = 10;
  
  while (exists && attempts < maxAttempts) {
    const newRandomNumbers = Math.floor(100000 + Math.random() * 900000);
    deviceId = `${branchPrefix}-${newRandomNumbers}-${dateString}`;
    exists = await this.findOne({ deviceId });
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Unable to generate unique device ID after multiple attempts');
  }
  
  return deviceId;
};

// ─── Hash Password Before Save ───────────────
deviceAccessSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// ─── Compare Method for Password ─────
deviceAccessSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

// ─── Machine Management Methods ─────
deviceAccessSchema.methods.addMachine = function(machineId, machineName, machineType) {
  const existingMachine = this.machines.find(m => m.machineId.toString() === machineId.toString());
  if (existingMachine) {
    throw new Error('Machine already associated with this device');
  }
  this.machines.push({
    machineId,
    machineName,
    machineType
  });
  return this.save();
};

deviceAccessSchema.methods.removeMachine = function(machineId) {
  this.machines = this.machines.filter(m => m.machineId.toString() !== machineId.toString());
  return this.save();
};

deviceAccessSchema.methods.getMachines = function() {
  return this.machines;
};

deviceAccessSchema.methods.hasAccessToMachine = function(machineId) {
  return this.machines.some(m => m.machineId.toString() === machineId.toString());
};

const DeviceAccess = mongoose.model("DeviceAccess", deviceAccessSchema);

module.exports = DeviceAccess;
module.exports.createDeviceAccessSchema = createDeviceAccessSchema;
module.exports.updateDeviceAccessSchema = updateDeviceAccessSchema;
module.exports.deviceMachineItemZodSchema = deviceMachineItemZodSchema;
module.exports.deviceLoginSchema = deviceLoginSchema;