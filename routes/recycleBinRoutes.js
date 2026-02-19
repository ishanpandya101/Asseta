const mongoose = require('mongoose');

const recycleBinSchema = new mongoose.Schema({
  entityType: String,
  data: Object,
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('RecycleBin', recycleBinSchema);
