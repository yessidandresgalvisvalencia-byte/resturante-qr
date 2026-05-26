const express = require("express");
const router = express.Router();

const Pedido = require("../models/pedido");
const Menu = require("../models/menu");

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
      mapaMenu[item.nombre] = {
        precioUnitarioActual: Number(item.precio || 0),
        categoria: item.categoria || ""
      };
    });

    const acumulado = {};

    pedidos.forEach(pedido => {
      const nombre =
        pedido.producto ||
        pedido.nombreProducto ||
        pedido.nombre ||
        "Producto sin nombre";

      const precioUnitarioActual =
        mapaMenu[nombre]?.precioUnitarioActual || 0;

      const categoria =
        mapaMenu[nombre]?.categoria || "";

      if (!acumulado[nombre]) {
        acumulado[nombre] = {
          producto: nombre,
          categoria,
          precioUnitarioActual,
          ventas: 0,
          totalCalculado: 0
        };
      }

      acumulado[nombre].ventas += 1;
      acumulado[nombre].totalCalculado += precioUnitarioActual;
    });

    const datos = Object.values(acumulado)
      .filter(p => {
        const n = p.producto.toLowerCase().trim();

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