const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  id: { type: Number, required: true },
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  categoria: { type: String, required: true },
  imagen: { type: String, default: "" },
  tiempoBase: { type: Number, default: 10 },
  disponible: { type: Boolean, default: true }
});

module.exports = mongoose.model("Menu", menuSchema);