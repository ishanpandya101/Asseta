const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  price: Number,
  vendor: String,
  quantity: Number,
});

module.exports = mongoose.model("Product", productSchema);
