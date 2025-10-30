const mongoose = require("mongoose");

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

module.exports = mongoose.model("DeviceMachineAssign", deviceMachineAssignSchema);