const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a new machine operator
const createMachineOperatorSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim(),
  pin: z.string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^[0-9]{4}$/, 'PIN must be 4 numeric digits'),
  machineId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format'),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  role: z.string()
    .optional()
    .default('operator')
});

// Zod schema for operator login
const loginMachineOperatorSchema = z.object({
  pin: z.string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^[0-9]{4}$/, 'PIN must be 4 numeric digits'),
  machineId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format')
    .optional(),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
    .optional()
});

// Zod schema for updating a machine operator
const updateMachineOperatorSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .trim()
    .optional(),
  pin: z.string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^[0-9]{4}$/, 'PIN must be 4 numeric digits')
    .optional(),
  machineId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format')
    .optional()
});

// Zod schema for machine operator ID parameter
const machineOperatorIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid machine operator ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const operatorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  role: { type: String, default: 'operator' },
}, { 
  timestamps: true,
  autoIndex: true  // Ensure indexes are managed by Mongoose
});

// Optionally, add compound unique index for PIN per branch
operatorSchema.index({ pin: 1, branchId: 1 }, { unique: false });

// ============================================================================
// EXPORTS
// ============================================================================

const Operator = mongoose.model('Operator', operatorSchema);

module.exports = Operator;
module.exports.createMachineOperatorSchema = createMachineOperatorSchema;
module.exports.loginMachineOperatorSchema = loginMachineOperatorSchema;
module.exports.updateMachineOperatorSchema = updateMachineOperatorSchema;
module.exports.machineOperatorIdSchema = machineOperatorIdSchema;