 const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  location: { type: String },
  code: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);