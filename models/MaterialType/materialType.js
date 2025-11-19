const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for creating MaterialType
const createMaterialTypeSchema = z.object({
  materialTypeName: z.string().min(1, 'Material type name is required').trim(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating MaterialType
const updateMaterialTypeSchema = z.object({
  materialTypeName: z.string().min(1, 'Material type name is required').trim().optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional()
}).strict();

const materialTypeSchema = new mongoose.Schema({
  materialTypeName: { type: String, required: true, unique: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

}, { timestamps: true });

const MaterialType = mongoose.model('MaterialType', materialTypeSchema);

module.exports = MaterialType;
module.exports.createMaterialTypeSchema = createMaterialTypeSchema;
module.exports.updateMaterialTypeSchema = updateMaterialTypeSchema;