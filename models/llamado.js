const mongoose = require("mongoose");

const llamadoSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  sedeId: {
  type: String,
  default: ""
},
  mesa: { type: Number, required: true },
  mensaje: { type: String, default: "Mesa necesita atención" },
  estado: { type: String, default: "pendiente" },
  meseroId: { type: String, default: "" },
  meseroNombre: { type: String, default: "" },
  // Secret digest is never returned in ordinary queries or staff panels.
  capabilityHash: { type: String, select: false, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Llamado", llamadoSchema);
