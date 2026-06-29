const mongoose = require("mongoose");

const solicitudLaboralSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true
  },
  empleadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmpleadoLaboral",
    required: true
  },
  empleadoNombre: String,
  tipo: {
    type: String,
    enum: ["hora_extra", "doble_turno"],
    required: true
  },
  estado: {
    type: String,
    enum: ["pendiente", "aprobada", "rechazada"],
    default: "pendiente"
  },
  observacion: String
}, {
  timestamps: true
});

module.exports = mongoose.model("SolicitudLaboral", solicitudLaboralSchema);