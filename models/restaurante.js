const mongoose = require("mongoose");

const restauranteSchema = new mongoose.Schema({
restaurantId: { type: String, required: true, unique: true },
nombreRestaurante: { type: String, required: true },
correo: { type: String, required: true },
usuarioAdmin: { type: String, required: true, unique: true },
passwordAdmin: { type: String, required: true },
logoUrl: {
  type: String,
  default: ""
},
gastos: {
  type: Array,
  default: []
},

primaryColor: {
  type: String,
  default: "#ff6600"
},

// 🔹 PLAN
plan: { type: String, default: "mensual" },
precioMensual: { type: Number, default: 220000 },

estadoSuscripcion: {
type: String,
enum: ["pendiente", "activa", "inactiva"],
default: "pendiente"
},

aceptaPlan: { type: Boolean, default: false },

// 🔹 FECHAS
fechaUltimoPago: { type: Date, default: null },
fechaProximoCobro: { type: Date, default: null },

// 🔹 PAGOS
ultimoTransactionId: { type: String, default: "" },
paymentSourceId: { type: String, default: "" },
customerEmailWompi: { type: String, default: "" },
tokenizacionCompleta: { type: Boolean, default: false },

// 🔥 NUEVO (IMPORTANTE)
wompiPublicKey: { type: String, default: "" },
WOMPI_PRIVATE_KEY: { type: String, default: "" },
paymentSourceId: {type: String, default: "" },
customerEmailWompi: {type: String, default: "" },
logoUrl: {
  type: String,
  default: ""
},

primaryColor: {
  type: String,
  default: "#ff6600"
},


}, { timestamps: true });

module.exports = mongoose.model("Restaurante", restauranteSchema);