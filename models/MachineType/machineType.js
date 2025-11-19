const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a new machine type
const createMachineTypeSchema = z.object({
  type: z.string()
    .min(1, 'Machine type name is required')
    .max(100, 'Machine type name must be less than 100 characters')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .trim(),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating a machine type
const updateMachineTypeSchema = z.object({
  type: z.string()
    .min(1, 'Machine type name is required')
    .max(100, 'Machine type name must be less than 100 characters')
    .trim()
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
});

// Zod schema for machine type ID parameter
const machineTypeIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machine type ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const machineTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true, 
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

}, { timestamps: true });

// ============================================================================
// EXPORTS
// ============================================================================

const MachineType = mongoose.model('MachineType', machineTypeSchema);

module.exports = MachineType;
module.exports.createMachineTypeSchema = createMachineTypeSchema;
module.exports.updateMachineTypeSchema = updateMachineTypeSchema;
module.exports.machineTypeIdSchema = machineTypeIdSchema;