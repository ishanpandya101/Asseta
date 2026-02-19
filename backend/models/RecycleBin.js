const mongoose = require('mongoose');

const recycleBinSchema = new mongoose.Schema({
  entityType: { type: String, required: true }, // e.g., 'Vendor', 'Product'
  data: { type: Object, required: true }, // stores deleted record data
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('RecycleBin', recycleBinSchema);
