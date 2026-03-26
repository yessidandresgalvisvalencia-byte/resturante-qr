const mongoose = require("mongoose");

const sedeSchema = new mongoose.Schema({
  restauranteId: {
    type: String,
    required: true
  },
  nombreSede: {
    type: String,
    required: true
  },
  codigoSede: {
    type: String,
    required: true,
    unique: true
  },
  direccion: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Sede", sedeSchema);