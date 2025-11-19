const mongoose = require("mongoose");
const { z } = require('zod');

// Zod schema for creating DeviceMachineAssign
const createDeviceMachineAssignSchema = z.object({
  deviceNameId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid deviceNameId format'),
  machines: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machine ID format')).min(1, 'At least one machine is required'),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating DeviceMachineAssign
const updateDeviceMachineAssignSchema = z.object({
  deviceNameId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid deviceNameId format').optional(),
  machines: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machine ID format')).min(1, 'At least one machine is required').optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional()
}).strict();

const deviceMachineAssignSchema = new mongoose.Schema(
  {
    deviceNameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeviceAccess",
      required: true,
    },
    machines: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Machine",
        required: true,
      },
    ],
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
  },
  {
    timestamps: true,
  }
  
);

const DeviceMachineAssign = mongoose.model("DeviceMachineAssign", deviceMachineAssignSchema);

module.exports = DeviceMachineAssign;
module.exports.createDeviceMachineAssignSchema = createDeviceMachineAssignSchema;
module.exports.updateDeviceMachineAssignSchema = updateDeviceMachineAssignSchema;