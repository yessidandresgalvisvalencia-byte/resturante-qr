"use strict";
const mongoose = require("mongoose");

const intentoPagoPedidoSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  restaurantId: { type: String, required: true, index: true },
  pedidoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pedido", required: true }],
  amountInCents: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "COP", enum: ["COP"] },
  estado: { type: String, default: "CREADO", enum: ["CREADO","PENDIENTE","APROBADO","RECHAZADO"] },
  transactionId: { type: String, default: "", index: true },
  resueltoAt: { type: Date, default: null },
  conciliacionLeaseUntil: { type: Date, default: null },
  conciliacionToken: { type: String, default: null },
  conciliacionReintentoAt: { type: Date, default: null },
  conciliacionIntentos: { type: Number, default: 0, min: 0 },
  conciliacionUltimoError: { type: String, default: null }
}, { timestamps: true });

intentoPagoPedidoSchema.index({ restaurantId: 1, estado: 1, conciliacionLeaseUntil: 1, updatedAt: 1 });

module.exports = mongoose.model("IntentoPagoPedido", intentoPagoPedidoSchema);
