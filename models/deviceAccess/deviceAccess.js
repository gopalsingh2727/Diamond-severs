const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const deviceAccessSchema = new mongoose.Schema(
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
    },
    // New machines array
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

// ─── Hash Password and Pin Before Save ───────────────
deviceAccessSchema.pre("save", async function (next) {
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

// ─── Optional: Compare Method for Password or Pin ─────
// Call this method to verify a password or pin during login if needed.
deviceAccessSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

deviceAccessSchema.methods.comparePin = async function (inputPin) {
  return await bcrypt.compare(inputPin, this.pin);
};

// ─── Machine Management Methods ─────
// Add a machine to the device
deviceAccessSchema.methods.addMachine = function(machineId, machineName, machineType) {
  // Check if machine already exists
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

// Remove a machine from the device
deviceAccessSchema.methods.removeMachine = function(machineId) {
  this.machines = this.machines.filter(m => m.machineId.toString() !== machineId.toString());
  return this.save();
};

// Get all machines for this device
deviceAccessSchema.methods.getMachines = function() {
  return this.machines;
};

// Check if device has access to a specific machine
deviceAccessSchema.methods.hasAccessToMachine = function(machineId) {
  return this.machines.some(m => m.machineId.toString() === machineId.toString());
};

module.exports = mongoose.model("DeviceAccess", deviceAccessSchema);