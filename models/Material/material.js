const mongoose = require("mongoose");
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a new material
const createMaterialSchema = z.object({
  materialName: z.string()
    .min(1, 'Material name is required')
    .max(200, 'Material name must be less than 200 characters')
    .trim(),
  materialMol: z.number()
    .positive('Material MOL must be a positive number'),
  materialType: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialType ID format'),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating a material
const updateMaterialSchema = z.object({
  materialName: z.string()
    .min(1, 'Material name is required')
    .max(200, 'Material name must be less than 200 characters')
    .trim()
    .optional(),
  materialMol: z.number()
    .positive('Material MOL must be a positive number')
    .optional(),
  materialType: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialType ID format')
    .optional()
});

// Zod schema for material ID parameter
const materialIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid material ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const materialSchema = new mongoose.Schema(
  {
    materialName: { type: String, required: true, unique: true },
    materialMol: { type: Number, required: true },
    materialType: { type: mongoose.Schema.Types.ObjectId, ref: "MaterialType", required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    
  },
  { timestamps: true }
);

// ============================================================================
// EXPORTS
// ============================================================================

const Material = mongoose.model("Material", materialSchema);

module.exports = Material;
module.exports.createMaterialSchema = createMaterialSchema;
module.exports.updateMaterialSchema = updateMaterialSchema;
module.exports.materialIdSchema = materialIdSchema;