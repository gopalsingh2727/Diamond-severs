// machine.js
const mongoose = require('mongoose');

// Machine Schema with Dynamic Table Integration
const machineSchema = new mongoose.Schema({
  machineName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  machineType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineType',
    required: true
  },
  sizeX: { 
    type: String, 
    required: true 
  },
  sizeY: { 
    type: String, 
    required: true 
  },
  sizeZ: { 
    type: String, 
    required: true 
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },

  
  // Dynamic Table Configuration for this machine
  tableConfig: {
    // Define columns for the machine's data table
    columns: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      dataType: {
        type: String,
        enum: ['text', 'number', 'formula', 'date'],
        default: 'text'
      },
      isRequired: {
        type: Boolean,
        default: false
      },
      order: {
        type: Number,
        required: true
      },
      placeholder: {
        type: String,
        default: ''
      }
    }],
    
    // Define formulas for automatic calculations
    formulas: {
      type: Map,
      of: {
        expression: {
          type: String,
          required: true
        },
        dependencies: {
          type: [String],
          default: []
        },
        description: {
          type: String,
          default: ''
        }
      },
      default: new Map()
    },
    
    // Table settings
    settings: {
      autoCalculate: {
        type: Boolean,
        default: true
      },
      autoUpdateOrders: {
        type: Boolean,
        default: true
      },
      maxRows: {
        type: Number,
        default: 1000
      },
      enableHistory: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Machine status and metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'repair'],
    default: 'active'
  },
  
  location: {
    type: String,
    trim: true
  },
  
  specifications: {
    capacity: String,
    powerConsumption: String,
    operatingTemperature: String,
    dimensions: String
  }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
machineSchema.index({ branchId: 1, machineName: 1 });
machineSchema.index({ status: 1 });
machineSchema.index({ machineType: 1 });

// Virtual to get machine's full identifier
machineSchema.virtual('fullName').get(function() {
  return `${this.machineName} (${this.sizeX}x${this.sizeY}x${this.sizeZ})`;
});

// Static method to create machine with default table config
machineSchema.statics.createWithDefaultTable = async function(machineData, tableType = 'basic') {
  const defaultConfigs = {
    basic: {
      columns: [
        { name: 'Material Type', dataType: 'text', isRequired: true, order: 0, placeholder: 'Enter material name' },
        { name: 'Raw Weight', dataType: 'number', isRequired: true, order: 1, placeholder: 'Enter raw weight in kg' },
        { name: 'Wastage', dataType: 'number', isRequired: false, order: 2, placeholder: 'Enter wastage in kg' },
        { name: 'Net Weight', dataType: 'formula', isRequired: false, order: 3, placeholder: 'Auto calculated' }
      ],
      formulas: new Map([
        ['Net Weight', { 
          expression: 'Raw Weight - Wastage', 
          dependencies: ['Raw Weight', 'Wastage'],
          description: 'Net weight after removing wastage'
        }]
      ])
    },
    
    advanced: {
      columns: [
        { name: 'Material Type', dataType: 'text', isRequired: true, order: 0, placeholder: 'Enter material name' },
        { name: 'Raw Weight', dataType: 'number', isRequired: true, order: 1, placeholder: 'Enter raw weight in kg' },
        { name: 'Wastage', dataType: 'number', isRequired: false, order: 2, placeholder: 'Enter wastage in kg' },
        { name: 'Net Weight', dataType: 'formula', isRequired: false, order: 3, placeholder: 'Auto calculated' },
        { name: 'Efficiency %', dataType: 'formula', isRequired: false, order: 4, placeholder: 'Auto calculated' },
        { name: 'Cost per KG', dataType: 'number', isRequired: false, order: 5, placeholder: 'Enter cost per kg' },
        { name: 'Total Cost', dataType: 'formula', isRequired: false, order: 6, placeholder: 'Auto calculated' }
      ],
      formulas: new Map([
        ['Net Weight', { 
          expression: 'Raw Weight - Wastage', 
          dependencies: ['Raw Weight', 'Wastage'],
          description: 'Net weight after removing wastage'
        }],
        ['Efficiency %', { 
          expression: '(Net Weight / Raw Weight) * 100', 
          dependencies: ['Net Weight', 'Raw Weight'],
          description: 'Production efficiency percentage'
        }],
        ['Total Cost', { 
          expression: 'Raw Weight * Cost per KG', 
          dependencies: ['Raw Weight', 'Cost per KG'],
          description: 'Total material cost'
        }]
      ])
    }
  };

  const config = defaultConfigs[tableType] || defaultConfigs.basic;
  
  const machine = new this({
    ...machineData,
    tableConfig: {
      columns: config.columns,
      formulas: config.formulas,
      settings: {
        autoCalculate: true,
        autoUpdateOrders: true,
        maxRows: 1000,
        enableHistory: true
      }
    }
  });

  return await machine.save();
};

// Instance method to update table configuration
machineSchema.methods.updateTableConfig = async function(newConfig) {
  // Validate that formula columns exist in columns array
  const columnNames = newConfig.columns.map(col => col.name);
  
  for (const [formulaCol] of newConfig.formulas || new Map()) {
    if (!columnNames.includes(formulaCol)) {
      throw new Error(`Formula column "${formulaCol}" not found in columns definition`);
    }
  }

  // Validate formula dependencies
  for (const [, formula] of newConfig.formulas || new Map()) {
    for (const dep of formula.dependencies || []) {
      if (!columnNames.includes(dep)) {
        throw new Error(`Formula dependency "${dep}" not found in columns definition`);
      }
    }
  }

  this.tableConfig = {
    ...this.tableConfig.toObject(),
    ...newConfig
  };

  return await this.save();
};

// Instance method to get table structure for frontend
machineSchema.methods.getTableStructure = function() {
  return {
    machineId: this._id,
    machineName: this.machineName,
    columns: this.tableConfig.columns.sort((a, b) => a.order - b.order),
    formulas: Object.fromEntries(this.tableConfig.formulas || new Map()),
    settings: this.tableConfig.settings
  };
};

// Pre-save middleware to validate table config
machineSchema.pre('save', function(next) {
  if (this.tableConfig && this.tableConfig.columns) {
    // Ensure order values are unique
    const orders = this.tableConfig.columns.map(col => col.order);
    const uniqueOrders = [...new Set(orders)];
    
    if (orders.length !== uniqueOrders.length) {
      return next(new Error('Column order values must be unique'));
    }
  }
  
  next();
});

// Export the model
module.exports = mongoose.models.Machine || mongoose.model('Machine', machineSchema);

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Create machine with basic table configuration
const basicMachine = await Machine.createWithDefaultTable({
  machineName: "Extruder A1",
  machineType: "64f7b1234567890123456789", // ObjectId
  sizeX: "100",
  sizeY: "200", 
  sizeZ: "150",
  branchId: "64f7b1234567890123456788", // ObjectId
  product27InfinityId: "64f7b1234567890123456787", // ObjectId
  location: "Production Floor 1"
}, 'basic');

// Example 2: Create machine with advanced table configuration
const advancedMachine = await Machine.createWithDefaultTable({
  machineName: "Injection Molding B2",
  machineType: "64f7b1234567890123456789",
  sizeX: "150",
  sizeY: "250", 
  sizeZ: "200",
  branchId: "64f7b1234567890123456788",
  product27InfinityId: "64f7b1234567890123456787",
  location: "Production Floor 2",
  specifications: {
    capacity: "500 kg/hour",
    powerConsumption: "50 kW",
    operatingTemperature: "200-250°C"
  }
}, 'advanced');

// Example 3: Update table configuration
await basicMachine.updateTableConfig({
  columns: [
    ...basicMachine.tableConfig.columns,
    { name: 'Temperature', dataType: 'number', isRequired: false, order: 4, placeholder: 'Enter temperature in °C' }
  ]
});

// Example 4: Get table structure for frontend
const tableStructure = basicMachine.getTableStructure();
console.log(tableStructure);
// Output:
// {
//   machineId: "64f7b1234567890123456789",
//   machineName: "Extruder A1",
//   columns: [
//     { name: 'Material Type', dataType: 'text', isRequired: true, order: 0 },
//     { name: 'Raw Weight', dataType: 'number', isRequired: true, order: 1 },
//     { name: 'Wastage', dataType: 'number', isRequired: false, order: 2 },
//     { name: 'Net Weight', dataType: 'formula', isRequired: false, order: 3 }
//   ],
//   formulas: {
//     'Net Weight': {
//       expression: 'Raw Weight - Wastage',
//       dependencies: ['Raw Weight', 'Wastage']
//     }
//   },
//   settings: { autoCalculate: true, autoUpdateOrders: true }
// }

// Example 5: Find machines by branch
const branchMachines = await Machine.find({ branchId: "64f7b1234567890123456788" })
  .populate('machineType')
  .populate('branchId');

// Example 6: Find active machines with table configs
const activeMachinesWithTables = await Machine.find({ 
  status: 'active',
  'tableConfig.columns': { $exists: true, $ne: [] }
});
*/