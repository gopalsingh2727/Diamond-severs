const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  machineName: {
    type: String,
    required: true,
    unique: true
  },
  machineType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineType',
    required: true
  },
  sizeX: { type: String, required: true },
  sizeY: { type: String, required: true },
  sizeZ: { type: String, required: true },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Machine', machineSchema);