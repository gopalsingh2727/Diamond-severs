const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  to: String,
  subject: String,
  html: String,
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'role',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'manager'],
    required: true,
  },
  sentAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Email', emailSchema);