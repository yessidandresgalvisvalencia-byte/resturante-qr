"use strict";

const { consumirEventoUnaVez } = require("../eventos/consumidorIdempotente.service");
const { prepararDesdeVenta } = require("./facturacion.service");
const Documento = require("./FacturacionDocumento");

async function consumirVentaEnFacturacion({ eventId, empresaId }) {
  return consumirEventoUnaVez({
    eventId,
    empresaId,
    consumidor: "FACTURACION_VENTA_V1",
    aplicar: async ({ evento, session }) => {
      const factura = await prepararDesdeVenta({
        empresaId,
        ventaId: evento.aggregateId,
        createdBy: null,
        session,
        emitirEvento: false
      });
      if (!factura || String(factura.empresaId) !== String(empresaId) ||
          String(factura.ventaId) !== String(evento.aggregateId)) {
        throw new Error("FACTURACION_DOCUMENTO_IDENTIDAD_INCONSISTENTE");
      }
      const confirmado = await Documento.exists({
        _id: factura._id,
        empresaId,
        ventaId: evento.aggregateId,
        deletedAt: null
      }).session(session);
      if (!confirmado) throw new Error("FACTURACION_DOCUMENTO_NO_PERSISTIDO");
    }
  });
}

module.exports = { consumirVentaEnFacturacion };
