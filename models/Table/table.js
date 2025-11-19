// table.js - MachineTableData Model
const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for row data item
const rowDataItemZodSchema = z.object({
  rowId: z.number().int().positive('Row ID must be positive'),
  data: z.record(z.any()).optional(),
  calculatedValues: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().default('system')
});

// Zod schema for total calculations
const totalCalculationsZodSchema = z.object({
  totalNetWeight: z.number().default(0),
  totalRawWeight: z.number().default(0),
  totalWastage: z.number().default(0),
  overallEfficiency: z.number().default(0),
  totalRows: z.number().int().default(0),
  averageEfficiency: z.number().default(0),
  totalCost: z.number().default(0)
});

// Zod schema for creating MachineTableData
const createMachineTableDataSchema = z.object({
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format'),
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid orderId format'),
  rowData: z.array(rowDataItemZodSchema).optional(),
  totalCalculations: totalCalculationsZodSchema.optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).default('active'),
  currentOperator: z.string().nullable().optional(),
  lastCalculatedAt: z.date().optional()
});

// Zod schema for updating MachineTableData
const updateMachineTableDataSchema = z.object({
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format').optional(),
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid orderId format').optional(),
  rowData: z.array(rowDataItemZodSchema).optional(),
  totalCalculations: totalCalculationsZodSchema.optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
  currentOperator: z.string().nullable().optional(),
  lastCalculatedAt: z.date().optional()
}).strict();

// Zod schema for adding row with data
const addRowDataSchema = z.record(z.any());

// Zod schema for updating row with data
const updateRowDataSchema = z.object({
  rowId: z.number().int().positive('Row ID must be positive'),
  data: z.record(z.any())
});

// Machine Table Data Schema - stores actual data for each machine's table in an order
const machineTableDataSchema = new mongoose.Schema({
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  // Array of rows with data
  rowData: [{
    rowId: {
      type: Number,
      required: true
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    },
    calculatedValues: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      default: 'system'
    }
  }],

  // Summary calculations for the entire table
  totalCalculations: {
    totalNetWeight: { type: Number, default: 0 },
    totalRawWeight: { type: Number, default: 0 },
    totalWastage: { type: Number, default: 0 },
    overallEfficiency: { type: Number, default: 0 },
    totalRows: { type: Number, default: 0 },
    averageEfficiency: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  },

  // Table status and metadata
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active'
  },

  // Operator information
  currentOperator: {
    type: String,
    default: null
  },

  // Last calculation timestamp
  lastCalculatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
machineTableDataSchema.index({ machineId: 1, orderId: 1 }, { unique: true });
machineTableDataSchema.index({ orderId: 1 });
machineTableDataSchema.index({ status: 1 });

// Virtual to get active row count
machineTableDataSchema.virtual('activeRowCount').get(function() {
  return this.rowData.length;
});

// Static method to initialize table data for an order
machineTableDataSchema.statics.initializeForOrder = async function(machineId, orderId, operatorName = 'system') {
  // Check if table already exists
  const existing = await this.findOne({ machineId, orderId });
  if (existing) {
    return existing;
  }

  // Get machine configuration
  const Machine = mongoose.model('Machine');
  const machine = await Machine.findById(machineId);

  if (!machine || !machine.tableConfig || !machine.tableConfig.columns || machine.tableConfig.columns.length === 0) {
    throw new Error('Machine not found or table configuration missing');
  }

  // Create new table data with empty initial state
  const tableData = new this({
    machineId,
    orderId,
    currentOperator: operatorName,
    rowData: [],
    status: 'active'
  });

  return await tableData.save();
};

// Instance method to add new row with data and calculations
machineTableDataSchema.methods.addRowWithCalculation = async function(inputData, operatorName = 'system') {
  const Machine = mongoose.model('Machine');
  const machine = await Machine.findById(this.machineId);

  if (!machine) {
    throw new Error('Machine not found');
  }

  const newRowId = Math.max(...this.rowData.map(r => r.rowId), 0) + 1;
  const dataMap = new Map(Object.entries(inputData));
  const calculatedValues = new Map();

  // Calculate formulas
  if (machine.tableConfig && machine.tableConfig.formulas) {
    for (const [columnName, formula] of machine.tableConfig.formulas || new Map()) {
      try {
        const result = this.calculateFormula(formula.expression, dataMap);
        calculatedValues.set(columnName, result);
        dataMap.set(columnName, result);
      } catch (error) {
        console.error(`Formula calculation error for ${columnName}:`, error.message);
        calculatedValues.set(columnName, 'Error');
      }
    }
  }

  // Add new row
  this.rowData.push({
    rowId: newRowId,
    data: dataMap,
    calculatedValues,
    updatedAt: new Date(),
    createdBy: operatorName
  });

  // Update summary calculations
  this.updateTotalCalculations();
  this.lastCalculatedAt = new Date();

  await this.save();

  // Update related order if auto-update is enabled
  if (machine.tableConfig && machine.tableConfig.settings && machine.tableConfig.settings.autoUpdateOrders) {
    await this.updateOrderData();
  }

  return {
    rowId: newRowId,
    data: Object.fromEntries(dataMap),
    calculatedValues: Object.fromEntries(calculatedValues)
  };
};

// Instance method to update existing row
machineTableDataSchema.methods.updateRow = async function(rowId, inputData, operatorName = 'system') {
  const rowIndex = this.rowData.findIndex(row => row.rowId === rowId);

  if (rowIndex === -1) {
    throw new Error('Row not found');
  }

  // Get machine configuration
  const Machine = mongoose.model('Machine');
  const machine = await Machine.findById(this.machineId);

  const dataMap = new Map(Object.entries(inputData));
  const calculatedValues = new Map();

  // Recalculate formulas
  if (machine.tableConfig && machine.tableConfig.formulas) {
    for (const [columnName, formula] of machine.tableConfig.formulas || new Map()) {
      try {
        const result = this.calculateFormula(formula.expression, dataMap);
        calculatedValues.set(columnName, result);
        dataMap.set(columnName, result);
      } catch (error) {
        calculatedValues.set(columnName, 'Error');
      }
    }
  }

  // Update the row
  this.rowData[rowIndex] = {
    ...this.rowData[rowIndex],
    data: dataMap,
    calculatedValues,
    updatedAt: new Date(),
    createdBy: operatorName
  };

  this.updateTotalCalculations();
  this.lastCalculatedAt = new Date();

  await this.save();

  if (machine.tableConfig && machine.tableConfig.settings && machine.tableConfig.settings.autoUpdateOrders) {
    await this.updateOrderData();
  }

  return {
    rowId,
    data: Object.fromEntries(dataMap),
    calculatedValues: Object.fromEntries(calculatedValues)
  };
};

// Instance method to delete a row
machineTableDataSchema.methods.deleteRow = async function(rowId) {
  if (this.rowData.length <= 1) {
    throw new Error('Cannot delete the last row');
  }

  this.rowData = this.rowData.filter(row => row.rowId !== rowId);
  this.updateTotalCalculations();
  this.lastCalculatedAt = new Date();

  await this.save();

  // Update order data
  const Machine = mongoose.model('Machine');
  const machine = await Machine.findById(this.machineId);
  if (machine && machine.tableConfig && machine.tableConfig.settings && machine.tableConfig.settings.autoUpdateOrders) {
    await this.updateOrderData();
  }

  return { success: true, deletedRowId: rowId };
};

// Formula calculation method
machineTableDataSchema.methods.calculateFormula = function(formula, rowData) {
  let expression = formula;

  // Replace column names with their values
  for (const [columnName, value] of rowData) {
    const numValue = parseFloat(value) || 0;
    const regex = new RegExp(`\\b${columnName}\\b`, 'g');
    expression = expression.replace(regex, numValue.toString());
  }

  try {
    // Remove any non-mathematical characters for security
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    const result = Function('"use strict"; return (' + sanitized + ')')();

    // Round to 2 decimal places
    return Math.round((result + Number.EPSILON) * 100) / 100;
  } catch (error) {
    throw new Error(`Invalid formula: ${formula}`);
  }
};

// Update total calculations method
machineTableDataSchema.methods.updateTotalCalculations = function() {
  let totalNetWeight = 0;
  let totalRawWeight = 0;
  let totalWastage = 0;
  let totalCost = 0;
  let efficiencySum = 0;
  let efficiencyCount = 0;

  this.rowData.forEach(row => {
    const netWt = parseFloat(row.calculatedValues.get('Net Weight') || row.data.get('Net Weight')) || 0;
    const rawWt = parseFloat(row.data.get('Raw Weight')) || 0;
    const wastage = parseFloat(row.data.get('Wastage')) || 0;
    const cost = parseFloat(row.calculatedValues.get('Total Cost') || row.data.get('Total Cost')) || 0;
    const efficiency = parseFloat(row.calculatedValues.get('Efficiency %')) || 0;

    totalNetWeight += netWt;
    totalRawWeight += rawWt;
    totalWastage += wastage;
    totalCost += cost;

    if (efficiency > 0) {
      efficiencySum += efficiency;
      efficiencyCount++;
    }
  });

  this.totalCalculations = {
    totalNetWeight,
    totalRawWeight,
    totalWastage,
    totalCost,
    totalRows: this.rowData.length,
    overallEfficiency: totalRawWeight > 0 ? ((totalNetWeight / totalRawWeight) * 100) : 0,
    averageEfficiency: efficiencyCount > 0 ? (efficiencySum / efficiencyCount) : 0
  };

  // Round all values to 2 decimal places
  Object.keys(this.totalCalculations).forEach(key => {
    if (typeof this.totalCalculations[key] === 'number') {
      this.totalCalculations[key] = Math.round((this.totalCalculations[key] + Number.EPSILON) * 100) / 100;
    }
  });
};

// Update order with real-time data
machineTableDataSchema.methods.updateOrderData = async function() {
  try {
    const Order = mongoose.model('Order');
    const order = await Order.findById(this.orderId);

    if (!order) {
      console.log('Order not found for update');
      return;
    }

    // Find and update the machine progress in the order
    let machineFound = false;

    for (let step of order.steps) {
      for (let machine of step.machines) {
        if (machine.machineId && machine.machineId.toString() === this.machineId.toString()) {
          machine.calculatedOutput = {
            netWeight: this.totalCalculations.totalNetWeight,
            wastageWeight: this.totalCalculations.totalWastage,
            efficiency: this.totalCalculations.overallEfficiency,
            totalCost: this.totalCalculations.totalCost,
            rowsProcessed: this.totalCalculations.totalRows,
            lastUpdated: new Date()
          };
          machine.machineTableDataId = this._id;
          machineFound = true;
          break;
        }
      }
      if (machineFound) break;
    }

    // Calculate order-level totals from all machines
    this.calculateOrderTotals(order);

    await order.save();
    console.log(`Order ${order.orderId} updated with machine table data`);

  } catch (error) {
    console.error('Error updating order data:', error);
  }
};

// Calculate order totals from all machines
machineTableDataSchema.methods.calculateOrderTotals = function(order) {
  let totalNetWeight = 0;
  let totalWastage = 0;
  let totalCost = 0;
  let machineCount = 0;
  let totalEfficiency = 0;

  order.steps.forEach(step => {
    step.machines.forEach(machine => {
      if (machine.calculatedOutput) {
        totalNetWeight += machine.calculatedOutput.netWeight || 0;
        totalWastage += machine.calculatedOutput.wastageWeight || 0;
        totalCost += machine.calculatedOutput.totalCost || 0;
        totalEfficiency += machine.calculatedOutput.efficiency || 0;
        machineCount++;
      }
    });
  });

  order.realTimeData = {
    totalNetWeight: Math.round((totalNetWeight + Number.EPSILON) * 100) / 100,
    totalWastage: Math.round((totalWastage + Number.EPSILON) * 100) / 100,
    totalCost: Math.round((totalCost + Number.EPSILON) * 100) / 100,
    overallEfficiency: machineCount > 0 ? Math.round(((totalEfficiency / machineCount) + Number.EPSILON) * 100) / 100 : 0,
    activeMachines: machineCount,
    completedMachines: 0,
    totalRowsProcessed: this.totalCalculations.totalRows,
    lastUpdated: new Date()
  };
};

// Instance method to get formatted table data for frontend
machineTableDataSchema.methods.getFormattedData = function() {
  return {
    tableId: this._id,
    machineId: this.machineId,
    orderId: this.orderId,
    status: this.status,
    operator: this.currentOperator,
    rows: this.rowData.map(row => ({
      id: row.rowId,
      data: Object.fromEntries(row.data),
      calculated: Object.fromEntries(row.calculatedValues),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
    })),
    totals: this.totalCalculations,
    lastCalculated: this.lastCalculatedAt
  };
};

// Static method to get summary for multiple tables
machineTableDataSchema.statics.getOrderSummary = async function(orderId) {
  const tables = await this.find({ orderId }).populate('machineId', 'machineName');

  const summary = {
    orderId,
    totalTables: tables.length,
    totalRows: 0,
    combinedTotals: {
      totalNetWeight: 0,
      totalRawWeight: 0,
      totalWastage: 0,
      totalCost: 0,
      overallEfficiency: 0
    },
    machineBreakdown: []
  };

  let efficiencySum = 0;
  let activeMachines = 0;

  tables.forEach(table => {
    summary.totalRows += table.rowData.length;
    summary.combinedTotals.totalNetWeight += table.totalCalculations.totalNetWeight;
    summary.combinedTotals.totalRawWeight += table.totalCalculations.totalRawWeight;
    summary.combinedTotals.totalWastage += table.totalCalculations.totalWastage;
    summary.combinedTotals.totalCost += table.totalCalculations.totalCost;

    if (table.totalCalculations.overallEfficiency > 0) {
      efficiencySum += table.totalCalculations.overallEfficiency;
      activeMachines++;
    }

    summary.machineBreakdown.push({
      machineName: table.machineId.machineName,
      rows: table.rowData.length,
      netWeight: table.totalCalculations.totalNetWeight,
      efficiency: table.totalCalculations.overallEfficiency,
      status: table.status
    });
  });

  summary.combinedTotals.overallEfficiency = activeMachines > 0 ?
    Math.round(((efficiencySum / activeMachines) + Number.EPSILON) * 100) / 100 : 0;

  return summary;
};

// Export the model
const MachineTableData = mongoose.models.MachineTableData || mongoose.model('MachineTableData', machineTableDataSchema);

module.exports = MachineTableData;
module.exports.createMachineTableDataSchema = createMachineTableDataSchema;
module.exports.updateMachineTableDataSchema = updateMachineTableDataSchema;
module.exports.rowDataItemZodSchema = rowDataItemZodSchema;
module.exports.totalCalculationsZodSchema = totalCalculationsZodSchema;
module.exports.addRowDataSchema = addRowDataSchema;
module.exports.updateRowDataSchema = updateRowDataSchema;
