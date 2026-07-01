const mongoose = require("mongoose");

const AsistenciaLaboralSchema = new mongoose.Schema({
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

module.exports = mongoose.model("AsistenciaLaboral", AsistenciaLaboralSchema);