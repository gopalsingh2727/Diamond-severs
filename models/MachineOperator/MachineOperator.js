const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true ,unique: true}, 
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  role: { 
    type: String, 
    enum: ['operator'], 
    default: 'operator' 
  },

}, { timestamps: true });

module.exports = mongoose.model('Operator', operatorSchema);