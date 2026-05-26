const express = require("express");
const router = express.Router();

const Pedido = require("../models/pedido");
const Menu = require("../models/menu");

function normalizar(texto = "") {
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

router.get("/pareto", async (req, res) => {
  try {
    const restaurantId =
      req.query.restaurantId ||
      req.query.restaurant ||
      "rest1";

    const pedidos = await Pedido.find({ restaurantId });
    const menu = await Menu.find({ restaurantId });

    const mapaMenu = {};

    menu.forEach(item => {
      const clave = normalizar(item.nombre);

      mapaMenu[clave] = {
  nombreOriginal: item.nombre,
  categoria: item.categoria || "",
  precioUnitarioActual: Number(item.precio || 0),
  costoMateriaPrimaUnitario: Number(item.costoMateriaPrima || 0)
};
    });

   const acumulado = {};

pedidos.forEach(pedido => {
  const nombrePedido =
    pedido.producto ||
    pedido.nombreProducto ||
    pedido.nombre ||
    "Producto sin nombre";

  const clave = normalizar(nombrePedido);

  const productoMenu = mapaMenu[clave];

  const nombreFinal =
    productoMenu?.nombreOriginal || nombrePedido;

  const categoria =
    productoMenu?.categoria || "";

  const precioUnitarioActual =
    productoMenu?.precioUnitarioActual || 0;

  const costoMateriaPrimaUnitario =
    productoMenu?.costoMateriaPrimaUnitario || 0;

  if (!acumulado[clave]) {
    acumulado[clave] = {
      producto: nombreFinal,
      categoria,
      precioUnitarioActual,

      costoMateriaPrimaUnitario,
      costoMateriaPrimaTotal: 0,

      ventas: 0,
      totalCalculado: 0
    };
  }

  acumulado[clave].ventas += 1;
  acumulado[clave].totalCalculado += precioUnitarioActual;

  acumulado[clave].costoMateriaPrimaTotal +=
    costoMateriaPrimaUnitario;
});

    const datos = Object.values(acumulado)
      .filter(p => {
        const n = normalizar(p.producto);

        return (
          n !== "cacac" &&
          n !== "test" &&
          n !== "prueba" &&
          !n.includes("xxxx")
        );
      })
      .sort((a, b) => b.ventas - a.ventas);

    res.json(datos);

  } catch (error) {
    console.error("Error en estadísticas:", error);

    res.status(500).json({
      error: "Error obteniendo estadísticas"
    });
  }
});

module.exports = router;