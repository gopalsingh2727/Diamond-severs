const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true, unique: true },
  productType: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductType', required: true },
  sizeX: { type: Number, required: true },
  sizeY: { type: Number, required: true },
  sizeZ: { type: Number, required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);