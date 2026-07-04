const mongoose = require("mongoose");

const MensajeLaboralSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true
  },

  remitenteId: String,
  remitenteNombre: String,

  remitenteRol: {
    type: String,
    enum: ["admin", "empleado"],
    default: "empleado"
  },

  destinatarioId: {
    type: String,
    default: ""
  },

  destinatarioNombre: {
    type: String,
    default: ""
  },

  tipoChat: {
    type: String,
    enum: ["general", "privado"],
    default: "general"
  },

  mensaje: {
    type: String,
    required: true
  },

  leido: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("MensajeLaboral", MensajeLaboralSchema);