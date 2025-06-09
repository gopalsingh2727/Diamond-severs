const mongoose = require('mongoose');

const machineTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true, // globally unique
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('MachineType', machineTypeSchema);