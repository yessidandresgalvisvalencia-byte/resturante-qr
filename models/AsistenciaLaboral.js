const mongoose = require("mongoose");

const AsistenciaLaboralSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: "Empresa", default: null, index: true },
  sedeId: { type: mongoose.Schema.Types.ObjectId, ref: "Sede", default: null, index: true },
  restaurantId: String,
  empleadoId: String,
  empleadoNombre: String,
  cargo: String,

  fecha: String,

  entradaReal: String,
  horaEntradaTexto: String,
  selfieEntrada: String,
  gpsEntrada: Object,

  salidaReal: String,
  horaSalidaTexto: String,
  selfieSalida: String,
  gpsSalida: Object,

  horasTrabajadas: {
    type: Number,
    default: 0
  },

  horasExtra: {
    type: Number,
    default: 0
  },

  dobleTurno: {
    type: Boolean,
    default: false
  },

  estado: {
    type: String,
    default: "entrada_registrada"
  },

  verificacionFacial: String
}, {
  timestamps: true
});

AsistenciaLaboralSchema.index({ empresaId: 1, sedeId: 1, fecha: 1 });
AsistenciaLaboralSchema.index({ empresaId: 1, empleadoId: 1, fecha: -1 });

module.exports = mongoose.model("AsistenciaLaboral", AsistenciaLaboralSchema);