const axios = require("axios");

async function obtenerTokenFactus() {
  const response = await axios.post(`${process.env.FACTUS_BASE_URL}/oauth/token`, {
    grant_type: "password",
    client_id: process.env.FACTUS_CLIENT_ID,
    client_secret: process.env.FACTUS_CLIENT_SECRET,
    username: process.env.FACTUS_USERNAME,
    password: process.env.FACTUS_PASSWORD,
  });

  return response.data.access_token;
}

function construirFacturaDesdePedido(pedido) {
  const productos = pedido.productos?.length
    ? pedido.productos
    : [
        {
          _id: pedido.id,
          nombre: pedido.descripcion || "Venta manual GRUK",
          cantidad: 1,
          precio: pedido.total,
        },
      ];

  return {
    numbering_range_id: pedido.numbering_range_id || 1,
    reference_code: `GRUK-${pedido._id || pedido.id}`,
    observation: "Factura generada desde GRUK",
    payment_method_code: "10",
    customer: {
      identification: pedido.cliente?.documento || pedido.documentoCliente || "222222222222",
      names: pedido.cliente?.nombre || pedido.cliente || "Consumidor final",
      email: pedido.cliente?.correo || pedido.correoCliente || "cliente@correo.com",
    },
    items: productos.map((p) => ({
      code_reference: String(p._id || p.id || p.nombre),
      name: p.nombre,
      quantity: p.cantidad || 1,
      price: p.precio || pedido.total,
      tax_rate: "19.00",
      unit_measure_id: 70,
      standard_code_id: 1,
      is_excluded: 0,
      tribute_id: 1,
    })),
  };
}

async function generarFacturaElectronica(pedido) {
  if (process.env.FACTUS_ENABLED !== "true") {
    return {
      modo: "PRUEBA_GRUK",
      estado: "simulada",
      mensaje: "Factura simulada. No fue enviada a DIAN.",
      reference_code: `GRUK-${pedido._id || pedido.id}`,
    };
  }

  const token = await obtenerTokenFactus();
  const facturaBody = construirFacturaDesdePedido(pedido);

  const response = await axios.post(
    `${process.env.FACTUS_BASE_URL}/v1/bills/validate`,
    facturaBody,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

module.exports = {
  generarFacturaElectronica,
};