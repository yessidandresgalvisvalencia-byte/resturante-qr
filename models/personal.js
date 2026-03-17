const mongoose = require("mongoose");

const personalSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  nombre: { type: String, required: true },
  cargo: { type: String, required: true },
  estado: { type: String, default: "disponible" },
  usuario: { type: String, required: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Personal", personalSchema);