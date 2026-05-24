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

    const mapaPrecios = {};

    menu.forEach(producto => {
      mapaPrecios[producto.nombre] = Number(producto.precio || 0);
    });

    const acumulado = {};

    pedidos.forEach(pedido => {
      const nombre =
        pedido.producto ||
        pedido.nombreProducto ||
        pedido.nombre ||
        "Producto sin nombre";

      const precioPedido =
        Number(
          pedido.precio ||
          pedido.total ||
          pedido.valor ||
          pedido.valorTotal ||
          pedido.precioUnitario ||
          0
        );

      const precioMenu =
        Number(mapaPrecios[nombre] || 0);

      const precioFinal =
        precioPedido > 0
          ? precioPedido
          : precioMenu;

      if (!acumulado[nombre]) {
        acumulado[nombre] = {
          producto: nombre,
          ventas: 0,
          precio: precioFinal,
          totalDinero: 0
        };
      }

      acumulado[nombre].ventas += 1;
      acumulado[nombre].totalDinero += precioFinal;

      if (!acumulado[nombre].precio && precioFinal) {
        acumulado[nombre].precio = precioFinal;
      }
    });

    const datos =
      Object.values(acumulado)
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