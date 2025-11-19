const mongoose = require('mongoose');
const { z } = require('zod');

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Zod schema for creating a new customer
const createCustomerSchema = z.object({
  companyName: z.string()
    .max(200, 'Company name must be less than 200 characters')
    .optional(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters'),
  phone1: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format'),
  phone2: z.string()
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
    .optional(),
  whatsapp: z.string()
    .max(15, 'WhatsApp number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid WhatsApp number format')
    .optional(),
  telephone: z.string()
    .max(15, 'Telephone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid telephone number format')
    .optional(),
  address1: z.string()
    .min(1, 'Address is required')
    .max(500, 'Address must be less than 500 characters'),
  address2: z.string()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  state: z.string()
    .min(1, 'State is required')
    .max(100, 'State must be less than 100 characters'),
  pinCode: z.string()
    .min(4, 'Pin code must be at least 4 digits')
    .max(10, 'Pin code must be less than 10 digits')
    .regex(/^[0-9]+$/, 'Pin code must contain only numbers'),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional(),
  imageUrl: z.string()
    .url('Invalid image URL')
    .optional(),
  branchId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format')
});

// Zod schema for updating a customer
const updateCustomerSchema = z.object({
  companyName: z.string()
    .max(200, 'Company name must be less than 200 characters')
    .optional(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .optional(),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .optional(),
  phone1: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
    .optional(),
  phone2: z.string()
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
    .optional(),
  whatsapp: z.string()
    .max(15, 'WhatsApp number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid WhatsApp number format')
    .optional(),
  telephone: z.string()
    .max(15, 'Telephone number must be less than 15 digits')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid telephone number format')
    .optional(),
  address1: z.string()
    .min(1, 'Address is required')
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  address2: z.string()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  state: z.string()
    .min(1, 'State is required')
    .max(100, 'State must be less than 100 characters')
    .optional(),
  pinCode: z.string()
    .min(4, 'Pin code must be at least 4 digits')
    .max(10, 'Pin code must be less than 10 digits')
    .regex(/^[0-9]+$/, 'Pin code must contain only numbers')
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional(),
  imageUrl: z.string()
    .url('Invalid image URL')
    .optional()
});

// Zod schema for customer ID parameter
const customerIdSchema = z.object({
  id: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid customer ID format')
});

// ============================================================================
// MONGOOSE SCHEMA
// ============================================================================

const customerSchema = new mongoose.Schema({
  companyName: { type: String, required: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone1: { type: String, required: true },
  phone2: { type: String },
  whatsapp: { type: String },
  telephone: { type: String },
  address1: { type: String, required: true },
  address2: { type: String },
  state: { type: String, required: true },
  pinCode: { type: String, required: true },
  email: { type: String },
  imageUrl: {
    type: String,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
 
}, { timestamps: true });


customerSchema.index(
  { branchId: 1, companyName: 1 },
  { unique: true, partialFilterExpression: { companyName: { $type: 'string' } } }
);

// ============================================================================
// EXPORTS
// ============================================================================

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

module.exports = Customer;
module.exports.createCustomerSchema = createCustomerSchema;
module.exports.updateCustomerSchema = updateCustomerSchema;
module.exports.customerIdSchema = customerIdSchema;