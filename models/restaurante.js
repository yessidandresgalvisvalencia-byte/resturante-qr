const mongoose = require("mongoose");

const restauranteSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true, unique: true },
  nombreRestaurante: { type: String, required: true },
  correo: { type: String, required: true },
  usuarioAdmin: { type: String, required: true, unique: true },
  passwordAdmin: { type: String, required: true },

  plan: { type: String, default: "mensual" },
  precioMensual: { type: Number, default: 200000 },

  estadoSuscripcion: {
    type: String,
    enum: ["pendiente", "activa", "inactiva"],
    default: "pendiente"
  },

  aceptaPlan: { type: Boolean, default: false },

  fechaUltimoPago: { type: Date, default: null },
  fechaProximoCobro: { type: Date, default: null },
  ultimoTransactionId: { type: String, default: "" },

  // 🔥 NUEVO (para cobro automático)
  paymentSourceId: { type: String, default: "" },
  customerEmailWompi: { type: String, default: "" },
  tokenizacionCompleta: { type: Boolean, default: false }

}, {
  timestamps: true // 🔥 recomendado
});

module.exports = mongoose.model("Restaurante", restauranteSchema);