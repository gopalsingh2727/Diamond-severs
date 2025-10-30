const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  companyName: { type: String, required: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone1: { type: String, required: true },
  phone2: { type: String },
  whatsapp: { type: String },
  telephone: { type: String },
  address1: { type: String, required: true },
  address2: { type: String },
  state: { type: String, required: true },
  pinCode: { type: String, required: true },
  email: { type: String },
  imageUrl: {
    type: String,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
 
}, { timestamps: true });


customerSchema.index(
  { branchId: 1, companyName: 1 },
  { unique: true, partialFilterExpression: { companyName: { $type: 'string' } } }
);

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);