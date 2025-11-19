const mongoose = require('mongoose');
const { z } = require('zod');

// Zod schema for creating MaterialUsageAnalytics
const createMaterialUsageAnalyticsSchema = z.object({
  periodType: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date(),
  endDate: z.date(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format'),
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format').optional(),
  materialId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format'),
  materialName: z.string().optional(),
  materialType: z.string().optional(),
  totalPlannedWeight: z.number().default(0),
  totalActualWeight: z.number().default(0),
  totalWastage: z.number().default(0),
  wastagePercentage: z.number().default(0),
  ordersUsedIn: z.number().int().default(0),
  totalProductsProduced: z.number().int().default(0),
  averageCostPerKg: z.number().optional(),
  totalCost: z.number().optional(),
  efficiencyScore: z.number().default(0),
  averageVariance: z.number().default(0),
  maxVariance: z.number().default(0),
  minVariance: z.number().default(0),
  averageMixingTime: z.number().default(0),
  totalMixingTime: z.number().default(0),
  calculatedAt: z.date().optional()
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be after or equal to start date',
  path: ['endDate']
});

// Zod schema for updating MaterialUsageAnalytics
const updateMaterialUsageAnalyticsSchema = z.object({
  periodType: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branchId format').optional(),
  machineId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid machineId format').optional(),
  materialId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid materialId format').optional(),
  materialName: z.string().optional(),
  materialType: z.string().optional(),
  totalPlannedWeight: z.number().optional(),
  totalActualWeight: z.number().optional(),
  totalWastage: z.number().optional(),
  wastagePercentage: z.number().optional(),
  ordersUsedIn: z.number().int().optional(),
  totalProductsProduced: z.number().int().optional(),
  averageCostPerKg: z.number().optional(),
  totalCost: z.number().optional(),
  efficiencyScore: z.number().optional(),
  averageVariance: z.number().optional(),
  maxVariance: z.number().optional(),
  minVariance: z.number().optional(),
  averageMixingTime: z.number().optional(),
  totalMixingTime: z.number().optional(),
  calculatedAt: z.date().optional()
}).strict();

const materialUsageAnalyticsSchema = new mongoose.Schema({
  // Time period
  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Scope
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine'
  },

  // Material data
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: String,
  materialType: String,

  // Usage statistics
  totalPlannedWeight: {
    type: Number,
    default: 0
  },
  totalActualWeight: {
    type: Number,
    default: 0
  },
  totalWastage: {
    type: Number,
    default: 0
  },
  wastagePercentage: {
    type: Number,
    default: 0
  },

  // Order statistics
  ordersUsedIn: {
    type: Number,
    default: 0
  },
  totalProductsProduced: {
    type: Number,
    default: 0
  },

  // Cost (if available)
  averageCostPerKg: Number,
  totalCost: Number,

  // Efficiency
  efficiencyScore: {
    type: Number,  // (actualWeight / plannedWeight) * 100
    default: 0
  },

  // Variance tracking
  averageVariance: {
    type: Number,
    default: 0
  },
  maxVariance: {
    type: Number,
    default: 0
  },
  minVariance: {
    type: Number,
    default: 0
  },

  // Mixing statistics
  averageMixingTime: {
    type: Number,
    default: 0
  },
  totalMixingTime: {
    type: Number,
    default: 0
  },

  // Updated timestamp
  calculatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
materialUsageAnalyticsSchema.index({ branchId: 1, periodType: 1, startDate: -1 });
materialUsageAnalyticsSchema.index({ materialId: 1, startDate: -1 });
materialUsageAnalyticsSchema.index({ machineId: 1, startDate: -1 });
materialUsageAnalyticsSchema.index({ periodType: 1, startDate: -1, endDate: -1 });

// Calculate wastage percentage before saving
materialUsageAnalyticsSchema.pre('save', function(next) {
  if (this.totalPlannedWeight > 0) {
    this.totalWastage = this.totalActualWeight - this.totalPlannedWeight;
    this.wastagePercentage = (this.totalWastage / this.totalPlannedWeight) * 100;
    this.efficiencyScore = (this.totalActualWeight / this.totalPlannedWeight) * 100;
  }
  next();
});

// Static method to generate analytics for a period
materialUsageAnalyticsSchema.statics.generateForPeriod = async function(branchId, startDate, endDate, periodType = 'monthly') {
  const Order = mongoose.model('Order');

  // Aggregate material usage from orders
  const pipeline = [
    {
      $match: {
        branchId: mongoose.Types.ObjectId(branchId),
        'mixingTracking.startTime': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        overallStatus: { $in: ['completed', 'dispatched'] }
      }
    },
    { $unwind: '$mixMaterial' },
    {
      $group: {
        _id: '$mixMaterial.materialId',
        materialName: { $first: '$mixMaterial.materialName' },
        totalPlannedWeight: { $sum: '$mixMaterial.plannedWeight' },
        totalActualWeight: { $sum: '$mixMaterial.actualWeight' },
        ordersCount: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        averageVariance: { $avg: '$mixMaterial.variance' },
        maxVariance: { $max: '$mixMaterial.variance' },
        minVariance: { $min: '$mixMaterial.variance' },
        averageMixingTime: { $avg: '$mixingTracking.actualMixingTime' },
        totalMixingTime: { $sum: '$mixingTracking.actualMixingTime' }
      }
    }
  ];

  const results = await Order.aggregate(pipeline);

  // Delete existing analytics for this period
  await this.deleteMany({
    branchId,
    periodType,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  });

  // Create new analytics records
  const analyticsRecords = results.map(r => ({
    periodType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    branchId,
    materialId: r._id,
    materialName: r.materialName,
    totalPlannedWeight: r.totalPlannedWeight,
    totalActualWeight: r.totalActualWeight,
    ordersUsedIn: r.ordersCount,
    totalProductsProduced: r.totalQuantity,
    averageVariance: r.averageVariance,
    maxVariance: r.maxVariance,
    minVariance: r.minVariance,
    averageMixingTime: r.averageMixingTime,
    totalMixingTime: r.totalMixingTime,
    calculatedAt: new Date()
  }));

  if (analyticsRecords.length > 0) {
    await this.insertMany(analyticsRecords);
  }

  return analyticsRecords;
};

const MaterialUsageAnalytics = mongoose.model('MaterialUsageAnalytics', materialUsageAnalyticsSchema);

module.exports = MaterialUsageAnalytics;
module.exports.createMaterialUsageAnalyticsSchema = createMaterialUsageAnalyticsSchema;
module.exports.updateMaterialUsageAnalyticsSchema = updateMaterialUsageAnalyticsSchema;
