const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for machine item in step
const stepMachineItemZodSchema = z.object({
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format'),
  reason: z.string().default(''),
  startedAt: z.date().optional(),
  completedAt: z.date().optional()
});

// Zod schema for creating Step
const createStepSchema = z.object({
  stepName: z.string().min(1, 'Step name is required'),
  machines: z.array(stepMachineItemZodSchema).optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating Step
const updateStepSchema = z.object({
  stepName: z.string().min(1, 'Step name is required').optional(),
  machines: z.array(stepMachineItemZodSchema).optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional()
}).strict();

const stepSchema = new mongoose.Schema({
  stepName: { type: String, required: true },


  machines: [
    {
      machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
      
      // status: {
      //   type: String,
      //   enum: ['pending', 'start', 'complete', 'stop',],
      //   default: 'pending',
      // },
      reason: { type: String, default: '' },
      startedAt: Date,
      completedAt: Date,
      
    },
    
  ],
 

  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
}, { timestamps: true });

const Step = mongoose.model('Step', stepSchema);

module.exports = Step;
module.exports.createStepSchema = createStepSchema;
module.exports.updateStepSchema = updateStepSchema;
module.exports.stepMachineItemZodSchema = stepMachineItemZodSchema;