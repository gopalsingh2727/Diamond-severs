/**
 * Seed Default Order Types
 *
 * This script creates default global order types that are available to all branches.
 * These order types provide different configurations for different manufacturing scenarios.
 *
 * Usage:
 *   node scripts/seedDefaultOrderTypes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const OrderType = require('../models/OrderType/orderType');

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://27shopgopal:S3kYB9MgKHPpaBjJ@cluster0.uvelucm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Default section configurations for manufacturing orders
const defaultSections = [
  {
    id: 'product',
    name: 'Product Information',
    enabled: true,
    order: 1,
    fields: [
      { name: 'productType', label: 'Product Type', type: 'suggestions', required: true, enabled: true },
      { name: 'productName', label: 'Product Name', type: 'suggestions', required: true, enabled: true },
      { name: 'bagType', label: 'Bag Type', type: 'select', required: false, enabled: true },
      { name: 'length', label: 'Length', type: 'number', required: false, enabled: true },
      { name: 'width', label: 'Width', type: 'number', required: false, enabled: true },
      { name: 'height', label: 'Height', type: 'number', required: false, enabled: true },
      { name: 'bagWeight', label: 'Bag Weight', type: 'number', required: false, enabled: true },
      { name: 'bottomGusset', label: 'Bottom Gusset', type: 'select', required: false, enabled: true },
      { name: 'flap', label: 'Flap', type: 'select', required: false, enabled: true },
      { name: 'airHole', label: 'Air Hole', type: 'select', required: false, enabled: true },
    ]
  },
  {
    id: 'material',
    name: 'Material Information',
    enabled: true,
    order: 2,
    fields: [
      { name: 'materialType', label: 'Material Type', type: 'suggestions', required: true, enabled: true },
      { name: 'materialName', label: 'Material Name', type: 'suggestions', required: true, enabled: true },
      { name: 'totalWeight', label: 'Total Weight (kg)', type: 'number', required: false, enabled: true },
      { name: 'onePieceWeight', label: 'One Piece Weight', type: 'number', required: false, enabled: true },
      { name: 'totalPieces', label: 'Total Pieces', type: 'number', required: false, enabled: true },
      { name: 'mixing', label: 'Mixing', type: 'select', required: false, enabled: true },
    ]
  },
  {
    id: 'printing',
    name: 'Printing Options',
    enabled: true,
    order: 3,
    fields: [
      { name: 'printEnabled', label: 'Print', type: 'select', required: false, enabled: true },
      { name: 'printLength', label: 'Print Length', type: 'number', required: false, enabled: true },
      { name: 'printWidth', label: 'Print Width', type: 'number', required: false, enabled: true },
      { name: 'printType', label: 'Print Type', type: 'select', required: false, enabled: true },
      { name: 'printColor', label: 'Print Color', type: 'text', required: false, enabled: true },
      { name: 'printImage', label: 'Print Image', type: 'text', required: false, enabled: true },
    ]
  },
  {
    id: 'steps',
    name: 'Manufacturing Steps',
    enabled: true,
    order: 4,
    fields: [
      { name: 'stepName', label: 'Step Name', type: 'suggestions', required: true, enabled: true },
      { name: 'machines', label: 'Machines', type: 'select', required: false, enabled: true },
      { name: 'operators', label: 'Operators', type: 'select', required: false, enabled: true },
      { name: 'startTime', label: 'Start Time', type: 'text', required: false, enabled: true },
      { name: 'endTime', label: 'End Time', type: 'text', required: false, enabled: true },
      { name: 'notes', label: 'Notes', type: 'text', required: false, enabled: true },
    ]
  },
];

// Default Order Types configuration
const defaultOrderTypes = [
  {
    typeName: 'Standard Manufacturing',
    typeCode: 'STD',
    description: 'Standard manufacturing order with all features available',
    numberPrefix: 'ORD',
    numberFormat: '{PREFIX}-{SEQUENCE}',
    sequencePadding: 4,

    // Specs are optional
    requiresProductSpec: false,
    requiresMaterialSpec: false,
    allowsProductSpec: true,
    allowsMaterialSpec: true,

    // Auto-configuration
    enablePrinting: false,
    enableMixing: false,
    autoAssignMachine: false,

    // Priority settings
    defaultPriority: 3, // Normal
    allowPriorityChange: true,

    // Workflow settings
    requiresApproval: false,
    approvalLevels: 1,

    // SLA configuration
    slaConfig: {
      standardTurnaroundDays: 7,
      urgentTurnaroundDays: 3,
      autoEscalateAfterDays: 10,
      sendReminderBeforeDays: 2
    },

    // Costing
    costingParams: {
      priceMultiplier: 1.0,
      additionalCharges: 0,
      discountPercentage: 0
    },

    // Form sections configuration for dynamic form
    sections: defaultSections,

    // Global and default
    isGlobal: true,
    isActive: true,
    isDefault: true
  },

  {
    typeName: 'Job Work',
    typeCode: 'JOB',
    description: 'Job work orders - customer provides material, we provide manufacturing',
    numberPrefix: 'JOB',
    numberFormat: '{PREFIX}-{SEQUENCE}',
    sequencePadding: 4,

    // Requires product spec, material spec optional
    requiresProductSpec: true,
    requiresMaterialSpec: false,
    allowsProductSpec: true,
    allowsMaterialSpec: true,

    // Auto-configuration
    enablePrinting: false,
    enableMixing: false,
    autoAssignMachine: false,

    // Priority settings
    defaultPriority: 3, // Normal
    allowPriorityChange: true,

    // Workflow settings
    requiresApproval: false,
    approvalLevels: 1,

    // SLA configuration
    slaConfig: {
      standardTurnaroundDays: 5,
      urgentTurnaroundDays: 2,
      autoEscalateAfterDays: 7,
      sendReminderBeforeDays: 1
    },

    // Costing - Different pricing for job work
    costingParams: {
      priceMultiplier: 0.8, // 20% less since customer provides material
      additionalCharges: 0,
      discountPercentage: 0
    },

    // Validation rules
    validationRules: {
      requiresCustomerApproval: true,
      maxPriorityLevel: 4
    },

    // Global
    isGlobal: true,
    isActive: true,
    isDefault: false
  },

  {
    typeName: 'Express Order',
    typeCode: 'EXP',
    description: 'High-priority express orders with faster turnaround',
    numberPrefix: 'EXP',
    numberFormat: '{PREFIX}-{SEQUENCE}',
    sequencePadding: 4,

    // Specs are optional
    requiresProductSpec: false,
    requiresMaterialSpec: false,
    allowsProductSpec: true,
    allowsMaterialSpec: true,

    // Auto-configuration
    enablePrinting: false,
    enableMixing: false,
    autoAssignMachine: true, // Auto-assign for faster processing

    // Priority settings - Express orders are high priority
    defaultPriority: 4, // High
    allowPriorityChange: false, // Cannot reduce priority

    // Workflow settings
    requiresApproval: true, // Requires approval due to priority
    approvalLevels: 1,

    // SLA configuration - Faster turnaround
    slaConfig: {
      standardTurnaroundDays: 3,
      urgentTurnaroundDays: 1,
      autoEscalateAfterDays: 4,
      sendReminderBeforeDays: 1
    },

    // Costing - Premium pricing for express service
    costingParams: {
      priceMultiplier: 1.5, // 50% premium
      additionalCharges: 500,
      discountPercentage: 0
    },

    // Validation rules
    validationRules: {
      requiresCustomerApproval: true,
      maxPriorityLevel: 5,
      minQuantity: 1,
      maxQuantity: 1000 // Limited quantity for express orders
    },

    // Global
    isGlobal: true,
    isActive: true,
    isDefault: false
  },

  {
    typeName: 'Sample/Test Order',
    typeCode: 'SMPL',
    description: 'Sample or test orders for quality verification and customer approval',
    numberPrefix: 'SMPL',
    numberFormat: '{PREFIX}-{SEQUENCE}',
    sequencePadding: 4,

    // Requires both product and material specs for proper testing
    requiresProductSpec: true,
    requiresMaterialSpec: true,
    allowsProductSpec: true,
    allowsMaterialSpec: true,

    // Auto-configuration
    enablePrinting: false,
    enableMixing: true, // Enable mixing for testing different formulations
    autoAssignMachine: false,

    // Priority settings
    defaultPriority: 3, // Normal
    allowPriorityChange: true,

    // Workflow settings
    requiresApproval: true, // Requires approval for tracking
    approvalLevels: 1,

    // SLA configuration
    slaConfig: {
      standardTurnaroundDays: 2,
      urgentTurnaroundDays: 1,
      autoEscalateAfterDays: 3,
      sendReminderBeforeDays: 1
    },

    // Costing - Typically free or low cost for samples
    costingParams: {
      priceMultiplier: 0.5, // 50% discount
      additionalCharges: 0,
      discountPercentage: 50
    },

    // Validation rules - Limit sample quantities
    validationRules: {
      requiresCustomerApproval: true,
      maxPriorityLevel: 4,
      minQuantity: 1,
      maxQuantity: 100 // Small quantities for samples
    },

    // Custom fields for sample tracking
    customFields: [
      {
        fieldName: 'testPurpose',
        fieldLabel: 'Test Purpose',
        fieldType: 'select',
        required: true,
        selectOptions: [
          'Quality Verification',
          'Customer Approval',
          'Process Testing',
          'Material Testing',
          'R&D'
        ]
      },
      {
        fieldName: 'expectedApprovalDate',
        fieldLabel: 'Expected Approval Date',
        fieldType: 'date',
        required: false
      },
      {
        fieldName: 'testNotes',
        fieldLabel: 'Test Notes',
        fieldType: 'text',
        required: false,
        placeholder: 'Any specific testing requirements or notes'
      }
    ],

    // Global
    isGlobal: true,
    isActive: true,
    isDefault: false
  },

  {
    typeName: 'Printing Order',
    typeCode: 'PRNT',
    description: 'Orders specifically for printing services',
    numberPrefix: 'PRNT',
    numberFormat: '{PREFIX}-{SEQUENCE}',
    sequencePadding: 4,

    // Specs are optional
    requiresProductSpec: false,
    requiresMaterialSpec: false,
    allowsProductSpec: true,
    allowsMaterialSpec: true,

    // Auto-configuration - Enable printing by default
    enablePrinting: true,
    enableMixing: false,
    autoAssignMachine: false,

    // Priority settings
    defaultPriority: 3, // Normal
    allowPriorityChange: true,

    // Workflow settings
    requiresApproval: false,
    approvalLevels: 1,

    // SLA configuration
    slaConfig: {
      standardTurnaroundDays: 5,
      urgentTurnaroundDays: 2,
      autoEscalateAfterDays: 7,
      sendReminderBeforeDays: 2
    },

    // Costing
    costingParams: {
      priceMultiplier: 1.2, // 20% premium for printing
      additionalCharges: 200,
      discountPercentage: 0
    },

    // Custom fields for printing details
    customFields: [
      {
        fieldName: 'designFileUrl',
        fieldLabel: 'Design File URL',
        fieldType: 'text',
        required: false,
        placeholder: 'URL to design file'
      },
      {
        fieldName: 'colorCount',
        fieldLabel: 'Number of Colors',
        fieldType: 'number',
        required: false
      },
      {
        fieldName: 'printType',
        fieldLabel: 'Print Type',
        fieldType: 'select',
        required: false,
        selectOptions: [
          'Flexographic',
          'Gravure',
          'Digital',
          'Screen Printing',
          'Offset'
        ]
      }
    ],

    // Global
    isGlobal: true,
    isActive: true,
    isDefault: false
  }
];

// Seed function
const seedOrderTypes = async () => {
  try {
    console.log('🌱 Starting to seed default order types...\n');

    // Check if order types already exist
    const existingCount = await OrderType.countDocuments({ isGlobal: true });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing global order types`);
      console.log('Do you want to:');
      console.log('  1. Skip seeding (existing types will remain)');
      console.log('  2. Clear and re-seed (will delete existing global types)');
      console.log('\nTo re-seed, run: node scripts/seedDefaultOrderTypes.js --force\n');

      // Check if --force flag is provided
      if (!process.argv.includes('--force')) {
        console.log('✅ Skipping seed - use --force to override\n');
        return;
      }

      console.log('🗑️  Clearing existing global order types...');
      await OrderType.deleteMany({ isGlobal: true });
      console.log('✅ Cleared existing types\n');
    }

    // Create each order type
    let created = 0;
    let failed = 0;

    for (const orderTypeData of defaultOrderTypes) {
      try {
        const orderType = new OrderType(orderTypeData);
        await orderType.save();
        console.log(`✅ Created: ${orderType.typeName} (${orderType.typeCode})`);
        created++;
      } catch (error) {
        console.error(`❌ Failed to create ${orderTypeData.typeName}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Seed Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${defaultOrderTypes.length}\n`);

    if (created > 0) {
      console.log('✅ Default order types seeded successfully!');

      // Display summary of created types
      const types = await OrderType.find({ isGlobal: true }).sort({ isDefault: -1, typeName: 1 });
      console.log('\n📋 Available Order Types:');
      types.forEach(type => {
        const defaultFlag = type.isDefault ? ' (DEFAULT)' : '';
        const reqSpecs = [];
        if (type.requiresProductSpec) reqSpecs.push('Product Spec');
        if (type.requiresMaterialSpec) reqSpecs.push('Material Spec');
        const reqText = reqSpecs.length > 0 ? ` - Requires: ${reqSpecs.join(', ')}` : '';
        console.log(`   - ${type.typeName} (${type.typeCode})${defaultFlag}${reqText}`);
      });
    }

  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectToDatabase();
    await seedOrderTypes();
    console.log('\n✅ Seeding completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { seedOrderTypes, defaultOrderTypes };
