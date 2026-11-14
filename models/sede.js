const mongoose = require("mongoose");

const sedeSchema = new mongoose.Schema({
  empresaId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Empresa",
  default: null,
  index: true
},
  restauranteId: {
    type: String,
    default: null,
    index: true
  },
  // Valla de autorización: escritura concurrente obligatoria para anular inventario.
  authFence: { type: Number, default: 0, min: 0 },
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