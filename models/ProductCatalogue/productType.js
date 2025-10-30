const mongoose = require('mongoose');

const productTypeSchema = new mongoose.Schema({
  productTypeName: {
    type: String,
    required: true,
    unique: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
   product27InfinityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product27Infinity',
      required: true,
     
    }
}, { timestamps: true });

module.exports = mongoose.model('ProductType', productTypeSchema);