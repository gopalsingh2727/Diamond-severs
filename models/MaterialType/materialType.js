const mongoose = require('mongoose');

const materialTypeSchema = new mongoose.Schema({
  materialTypeName: { type: String, required: true, unique: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
 
}, { timestamps: true });


module.exports = mongoose.model('MaterialType', materialTypeSchema);