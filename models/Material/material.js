const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    materialName: { type: String, required: true, unique: true },
    materialMol: { type: Number, required: true },
    materialType: { type: mongoose.Schema.Types.ObjectId, ref: "MaterialType", required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", materialSchema);