const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true, unique: true },
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model("Admin", adminSchema);