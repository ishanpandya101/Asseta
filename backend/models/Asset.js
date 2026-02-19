const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: String,
  assignedTo: String,
  status: String,
  purchaseDate: Date,
});

module.exports = mongoose.model("Asset", assetSchema);
