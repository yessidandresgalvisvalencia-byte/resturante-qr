const mongoose = require("mongoose");

const solicitudLaboralSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: "Empresa", default: null, index: true },
  sedeId: { type: mongoose.Schema.Types.ObjectId, ref: "Sede", default: null, index: true },
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

solicitudLaboralSchema.index({ empresaId: 1, estado: 1, createdAt: -1 });

module.exports = mongoose.model("SolicitudLaboral", solicitudLaboralSchema);