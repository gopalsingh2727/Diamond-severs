const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const AdminuserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    default: 'admin'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  // Reference to Product27Infinity
  product27InfinityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product27Infinity',
    required: true
  }
});

// Middleware: Hash the password before saving
AdminuserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method: Compare input password with stored hash
AdminuserSchema.methods.comparePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

// Export the model
module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminuserSchema);