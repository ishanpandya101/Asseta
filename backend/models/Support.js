const mongoose = require('mongoose');

const supportSchema = new mongoose.Schema({
  user: String,
  subject: String,
  message: String,
  status: { type: String, default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Support', supportSchema);
