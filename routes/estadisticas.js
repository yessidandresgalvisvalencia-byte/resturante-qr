const express = require("express");
const router = express.Router();

const Pedido = require("../models/pedido");

router.get("/pareto", async (req, res) => {
  try {
    const restaurantId =
      req.query.restaurantId ||
      req.query.restaurant ||
      "rest1";

    const datos = await Pedido.aggregate([
      {
        $match: {
          restaurantId: restaurantId
        }
      },
      {
        $addFields: {
          precioNumerico: {
            $convert: {
              input: "$precio",
              to: "double",
              onError: 0,
              onNull: 0
            }
          }
        }
      },
      {
        $group: {
          _id: "$producto",
          ventas: { $sum: 1 },
          precioPromedio: { $avg: "$precioNumerico" },
          totalDinero: { $sum: "$precioNumerico" }
        }
      },
      {
        $project: {
          _id: 0,
          producto: "$_id",
          ventas: 1,
          precioPromedio: { $round: ["$precioPromedio", 0] },
          totalDinero: { $round: ["$totalDinero", 0] }
        }
      },
      {
        $match: {
          producto: {
            $nin: ["CACAC", "test", "prueba", "TEST", "Prueba"]
          }
        }
      },
      {
        $sort: {
          ventas: -1
        }
      }
    ]);

    res.json(datos);

  } catch (error) {
    console.error("Error en estadísticas:", error);

    res.status(500).json({
      error: "Error obteniendo estadísticas"
    });
  }
});

module.exports = router;