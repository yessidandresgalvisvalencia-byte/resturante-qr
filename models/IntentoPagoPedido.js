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
  resueltoAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model("IntentoPagoPedido", intentoPagoPedidoSchema);
