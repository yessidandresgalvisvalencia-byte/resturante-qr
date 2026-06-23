const mongoose = require("mongoose");

const FacturaSchema = new mongoose.Schema(
  {
    pedidoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pedido",
      required: true,
    },
    restaurantId: String,
    estado: String,
    modo: String,
    referenceCode: String,
    numeroFactura: String,
    cufe: String,
    pdfUrl: String,
    xmlUrl: String,
    respuestaProveedor: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Factura", FacturaSchema);