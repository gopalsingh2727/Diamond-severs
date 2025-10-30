const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  stepName: { type: String, required: true },


  machines: [
    {
      machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
      
      status: {
        type: String,
        enum: ['pending', 'start', 'complete', 'stop',],
        default: 'pending',
      },
      reason: { type: String, default: '' },
      startedAt: Date,
      completedAt: Date,
      
    },
    
  ],
 

  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Step', stepSchema);