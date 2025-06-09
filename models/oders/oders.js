const mongoose = require('mongoose');

const machineProgressSchema = new mongoose.Schema({
  machineName: { type: String, required: true },
  machineType: { type: String, required: true },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  reason: { type: String, default: null }
});

const stepProgressSchema = new mongoose.Schema({
  stepId: { type: mongoose.Schema.Types.ObjectId, ref: 'Step', required: true },
  machines: [machineProgressSchema]
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true }, 

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productSize: {
    sizeX: { type: Number, required: true },
    sizeY: { type: Number, required: true },
    sizeZ: { type: Number, required: true }
  },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  materialWeight: { type: Number, required: true },
  
  productPieces: { type: Number, required: true },
  quantity: { type: Number, required: true },

  steps: [stepProgressSchema],
  currentStepIndex: { type: Number, default: 0 },
  overallStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'dispatched', 'cancelled'],
    default: 'pending'
  },

  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByRole', required: true },
  createdByRole: { type: String, enum: ['admin', 'manager'], required: true }
}, { timestamps: true });

orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const branch = await mongoose.model('Branch').findById(this.branchId);

    if (!branch || !branch.code) {
      return next(new Error("Branch not found or missing code"));
    }

    const branchCode = branch.code;

    const date = new Date();
    const yyyyMMdd = date.toISOString().split('T')[0].replace(/-/g, '');

    const count = await mongoose.model('Order').countDocuments({
      branchId: this.branchId,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    this.orderId = `ORD-${branchCode}-${yyyyMMdd}-${(count + 1).toString().padStart(3, '0')}`;
  }

  next();
});




module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
