const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  materialName: { type: String, required: true, unique: true },
  materialType: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema); 