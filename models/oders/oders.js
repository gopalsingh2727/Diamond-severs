// order.js
const mongoose = require('mongoose');

// Machine Progress Schema - enhanced with table data integration
const machineProgressSchema = new mongoose.Schema({
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine',
    required: false
  },
  operatorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false, 
    default: null 
  },
  operatorName: {
    type: String,
    default: null
  },
  // FIXED: Added 'none' status for machines not yet ready
  status: { 
    type: String, 
    enum: ['none', 'pending', 'in-progress', 'completed', 'paused', 'error'], 
    default: 'none'  // Changed default to 'none'
  },
  startedAt: { 
    type: Date, 
    default: null 
  },
  completedAt: { 
    type: Date, 
    default: null 
  },
  note: { 
    type: String, 
    default: null 
  },
  reason: { 
    type: String, 
    default: null 
  },
  
  // Link to machine table data
  machineTableDataId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MachineTableData'
  },
  
  // Real-time calculated values from machine table
  calculatedOutput: {
    netWeight: { 
      type: Number, 
      default: 0 
    },
    wastageWeight: { 
      type: Number, 
      default: 0 
    },
    efficiency: { 
      type: Number, 
      default: 0 
    },
    totalCost: { 
      type: Number, 
      default: 0 
    },
    rowsProcessed: { 
      type: Number, 
      default: 0 
    },
    lastUpdated: { 
      type: Date, 
      default: Date.now 
    }
  },
  
  // Machine specific settings
  targetOutput: {
    expectedWeight: { type: Number, default: 0 },
    expectedEfficiency: { type: Number, default: 90 },
    maxWastage: { type: Number, default: 5 }
  },
  
  // Quality control flags
  qualityStatus: {
    type: String,
    enum: ['pending', 'passed', 'failed', 'review'],
    default: 'pending'
  },
  
  qualityNotes: [String]
});

// Step Progress Schema
const stepProgressSchema = new mongoose.Schema({
  stepId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Step', 
    required: true 
  },

  machines: [machineProgressSchema],
  stepStatus: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'blocked',"none" , "pause"],
    default: 'pending'
  },
  stepStartedAt: Date,
  stepCompletedAt: Date,
  stepNotes: String
});

// Mix Material Schema - enhanced with real-time tracking
const mixMaterialSchema = new mongoose.Schema({
  materialId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material', 
    required: true 
  },
  materialName: {
    type: String,
    required: true
  },
  plannedWeight: { 
    type: Number, 
    required: true 
  },
  
  // Real-time tracking from machine tables
  actualUsedWeight: { 
    type: Number, 
    default: 0 
  },
  wastageWeight: { 
    type: Number, 
    default: 0 
  },
  efficiency: { 
    type: Number, 
    default: 0 
  },
  costPerKg: { 
    type: Number, 
    default: 0 
  },
  totalCost: { 
    type: Number, 
    default: 0 
  },
  
  // Material quality and specifications
  specifications: {
    grade: String,
    color: String,
    density: Number,
    additives: [String]
  },
  
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
});

// Main Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { 
    type: String, 
    unique: true 
  },
  
  // Customer and basic info
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true 
  },

  
  // Material specifications
  materialId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Material', 
    required: true 
  },
  materialWeight: { 
    type: Number, 
    required: true 
  },
  
  // Product dimensions
  Width: { 
    type: Number, 
    required: true 
  },
  Height: { 
    type: Number, 
    required: true 
  },
  Thickness: { 
    type: Number, 
    required: true 
  },
  
  // Additional specifications
  SealingType: { 
    type: String, 
    required: false, 
    default: null 
  },
  BottomGusset: { 
    type: String, 
    required: false, 
    default: null 
  },
  Flap: { 
    type: String, 
    required: false, 
    default: null 
  },
  AirHole: { 
    type: String, 
    required: false, 
    default: null  
  },
  Printing: { 
    type: Boolean, 
    default: false 
  },
  
  // Color and design specifications
  colors: [String],
  designNotes: String,
  specialInstructions: String,
  
  // Materials and production steps
  mixMaterial: [mixMaterialSchema],
  steps: [stepProgressSchema],
  
  // Order progression
  currentStepIndex: { 
    type: Number, 
    default: 0 
  },
  overallStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'dispatched', 'cancelled', 'Wait for Approval', 'completed'],
    default: 'Wait for Approval'
  },
  
  // Priority and scheduling
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  scheduledStartDate: Date,
  scheduledEndDate: Date,
  actualStartDate: Date,
  actualEndDate: Date,
  
  // Location and management
  branchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Branch', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'createdByRole', 
    required: true 
  },
  createdByRole: { 
    type: String, 
    enum: ['admin', 'manager'], 
    required: true 
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Real-time totals from all machine tables
  realTimeData: {
    totalNetWeight: { 
      type: Number, 
      default: 0 
    },
    totalWastage: { 
      type: Number, 
      default: 0 
    },
    totalCost: { 
      type: Number, 
      default: 0 
    },
    overallEfficiency: { 
      type: Number, 
      default: 0 
    },
    activeMachines: { 
      type: Number, 
      default: 0 
    },
    completedMachines: { 
      type: Number, 
      default: 0 
    },
    totalRowsProcessed: { 
      type: Number, 
      default: 0 
    },
    lastUpdated: { 
      type: Date, 
      default: Date.now 
    }
  },
  
  // Quality control
  qualityControl: {
    inspectionRequired: { type: Boolean, default: true },
    inspectionStatus: { 
      type: String, 
      enum: ['pending', 'in_progress', 'passed', 'failed', 'review'],
      default: 'pending'
    },
    inspectedBy: String,
    inspectionDate: Date,
    qualityScore: { type: Number, min: 0, max: 100 },
    qualityNotes: [String],
    defects: [String]
  },
  
  // Financial information
  financial: {
    estimatedCost: { type: Number, default: 0 },
    actualCost: { type: Number, default: 0 },
    materialCost: { type: Number, default: 0 },
    laborCost: { type: Number, default: 0 },
    overheadCost: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 }
  },
  
  // Delivery information
  delivery: {
    expectedDate: Date,
    actualDate: Date,
    deliveryAddress: String,
    shippingMethod: String,
    trackingNumber: String,
    deliveryStatus: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'delayed'],
      default: 'pending'
    }
  },
  
  // Notes and communication
  notes: [{
    message: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    noteType: {
      type: String,
      enum: ['general', 'production', 'quality', 'delivery', 'customer'],
      default: 'general'
    }
  }],
  
  // Files and attachments
  attachments: [{
    filename: String,
    fileUrl: String,
    fileType: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ branchId: 1, createdAt: -1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ overallStatus: 1 });
orderSchema.index({ priority: 1, scheduledStartDate: 1 });
orderSchema.index({ 'realTimeData.lastUpdated': -1 });

// Virtual for order completion percentage
orderSchema.virtual('completionPercentage').get(function() {
  if (!this.steps || this.steps.length === 0) return 0;
  
  const completedSteps = this.steps.filter(step => step.stepStatus === 'completed').length;
  return Math.round((completedSteps / this.steps.length) * 100);
});

// Virtual for total estimated duration
orderSchema.virtual('estimatedDuration').get(function() {
  if (this.scheduledStartDate && this.scheduledEndDate) {
    return Math.ceil((this.scheduledEndDate - this.scheduledStartDate) / (1000 * 60 * 60 * 24)); // days
  }
  return 0;
});

// Pre-save middleware for Order ID generation
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderId) {
    try {
      const branch = await mongoose.model('Branch').findById(this.branchId);
      
      if (!branch || !branch.code) {
        return next(new Error("Branch not found or missing code"));
      }
      
      const branchCode = branch.code;
      const date = new Date();
      const yyyyMMdd = date.toISOString().split('T')[0].replace(/-/g, '').substring(2);
      
      const count = await mongoose.model('Order').countDocuments({
        branchId: this.branchId,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });
      
      this.orderId = `ORD-${branchCode}-${yyyyMMdd}-${(count + 1).toString().padStart(3, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// FIXED: Instance method to initialize step machines with proper status
orderSchema.methods.initializeStepMachines = function() {
  this.steps.forEach(step => {
    if (step.machines && step.machines.length > 0) {
      // Set first machine to 'pending', rest to 'none'
      step.machines.forEach((machine, index) => {
        if (index === 0) {
          machine.status = 'pending';  // First machine ready to work
        } else {
          machine.status = 'none';     // Other machines waiting
        }
      });
    }
  });
  return this;
};

// FIXED: Instance method to move to next machine in step
orderSchema.methods.completeCurrentMachine = async function(stepIndex) {
  if (this.steps[stepIndex] && this.steps[stepIndex].machines.length > 0) {
    const machines = this.steps[stepIndex].machines;
    
    // Find current active machine and complete it
    for (let i = 0; i < machines.length; i++) {
      if (machines[i].status === 'in-progress') {
        machines[i].status = 'completed';
        machines[i].completedAt = new Date();
        
        // Set next machine to pending (if exists)
        if (i + 1 < machines.length && machines[i + 1].status === 'none') {
          machines[i + 1].status = 'pending';
          machines[i + 1].startedAt = null; // Reset start time for new machine
        }
        
        break;
      }
    }
  }
  
  return await this.save();
};

// Instance method to update real-time data from machine tables
orderSchema.methods.updateRealTimeData = async function() {
  const MachineTableData = mongoose.model('MachineTableData');
  
  // Get all machine table data for this order
  const machineTables = await MachineTableData.find({ orderId: this._id });
  
  let totalNetWeight = 0;
  let totalWastage = 0;
  let totalCost = 0;
  let totalRows = 0;
  let activeMachines = 0;
  let completedMachines = 0;
  let efficiencySum = 0;
  let efficiencyCount = 0;

  machineTables.forEach(table => {
    totalNetWeight += table.totalCalculations.totalNetWeight || 0;
    totalWastage += table.totalCalculations.totalWastage || 0;
    totalCost += table.totalCalculations.totalCost || 0;
    totalRows += table.rowData.length || 0;
    
    if (table.status === 'active') activeMachines++;
    if (table.status === 'completed') completedMachines++;
    
    if (table.totalCalculations.overallEfficiency > 0) {
      efficiencySum += table.totalCalculations.overallEfficiency;
      efficiencyCount++;
    }
  });

  this.realTimeData = {
    totalNetWeight: Math.round((totalNetWeight + Number.EPSILON) * 100) / 100,
    totalWastage: Math.round((totalWastage + Number.EPSILON) * 100) / 100,
    totalCost: Math.round((totalCost + Number.EPSILON) * 100) / 100,
    overallEfficiency: efficiencyCount > 0 ? 
      Math.round(((efficiencySum / efficiencyCount) + Number.EPSILON) * 100) / 100 : 0,
    activeMachines,
    completedMachines,
    totalRowsProcessed: totalRows,
    lastUpdated: new Date()
  };

  this.financial.actualCost = this.realTimeData.totalCost;
  
  return await this.save();
};

// Instance method to progress to next step
orderSchema.methods.progressToNextStep = async function() {
  if (this.currentStepIndex < this.steps.length - 1) {
    if (this.steps[this.currentStepIndex]) {
      this.steps[this.currentStepIndex].stepStatus = 'completed';
      this.steps[this.currentStepIndex].stepCompletedAt = new Date();
    }
    
    this.currentStepIndex += 1;
    
    if (this.steps[this.currentStepIndex]) {
      this.steps[this.currentStepIndex].stepStatus = 'in-progress';
      this.steps[this.currentStepIndex].stepStartedAt = new Date();
      // FIXED: Initialize machines for this new step
      this.initializeStepMachines();
    }
    
    if (this.currentStepIndex === this.steps.length - 1) {
      this.overallStatus = 'in_progress';
    }
  } else {
    this.overallStatus = 'completed';
    this.actualEndDate = new Date();
  }
  
  return await this.save();
};

// Instance method to add note
orderSchema.methods.addNote = async function(message, createdBy, noteType = 'general') {
  this.notes.push({
    message,
    createdBy,
    noteType,
    createdAt: new Date()
  });
  
  return await this.save();
};

// Instance method to update quality control
orderSchema.methods.updateQualityControl = async function(qualityData) {
  this.qualityControl = {
    ...this.qualityControl.toObject(),
    ...qualityData,
    inspectionDate: new Date()
  };
  
  return await this.save();
};

// Static method to get order dashboard data
orderSchema.statics.getDashboardData = async function(branchId, dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  const pipeline = [
    {
      $match: {
        branchId: new mongoose.Types.ObjectId(branchId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$overallStatus',
        count: { $sum: 1 },
        totalWeight: { $sum: '$realTimeData.totalNetWeight' },
        totalCost: { $sum: '$realTimeData.totalCost' },
        avgEfficiency: { $avg: '$realTimeData.overallEfficiency' }
      }
    }
  ];
  
  const statusSummary = await this.aggregate(pipeline);
  
  return {
    dateRange: `${dateRange} days`,
    statusBreakdown: statusSummary,
    totalOrders: statusSummary.reduce((sum, item) => sum + item.count, 0)
  };
};

// Static method to get production efficiency report
orderSchema.statics.getEfficiencyReport = async function(branchId, startDate, endDate) {
  return await this.find({
    branchId,
    createdAt: { $gte: startDate, $lte: endDate },
    'realTimeData.overallEfficiency': { $gt: 0 }
  })
  .select('orderId customerName realTimeData.overallEfficiency realTimeData.totalNetWeight steps')
  .populate('customerId', 'name')
  .sort({ 'realTimeData.overallEfficiency': -1 });
};

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);