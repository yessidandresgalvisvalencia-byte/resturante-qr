const express = require("express");
const mongoose = require("mongoose");

const Venta = require("../models/Venta");
const Gasto = require("../models/Gasto");
const Empresa = require("../models/Empresa");

const router = express.Router();

router.get("/resumen/:empresaId", async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { desde, hasta, sedeId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(empresaId)) {
      return res.status(400).json({
        ok: false,
        error: "empresaId inválido"
      });
    }

    const empresa = await Empresa.findById(empresaId);

    if (!empresa) {
      return res.status(404).json({
        ok: false,
        error: "Empresa no encontrada"
      });
    }

    // =========================
    // FILTRO DE FECHAS
    // =========================

    const filtroFechaVenta = {};
    const filtroFechaGasto = {};

    if (desde || hasta) {
      filtroFechaVenta.fecha = {};
      filtroFechaGasto.fecha = {};

      if (desde) {
        const fechaDesde = new Date(desde);

        if (isNaN(fechaDesde.getTime())) {
          return res.status(400).json({
            ok: false,
            error: "Fecha 'desde' inválida"
          });
        }

        filtroFechaVenta.fecha.$gte = fechaDesde;
        filtroFechaGasto.fecha.$gte = fechaDesde;
      }

      if (hasta) {
        const fechaHasta = new Date(hasta);

        if (isNaN(fechaHasta.getTime())) {
          return res.status(400).json({
            ok: false,
            error: "Fecha 'hasta' inválida"
          });
        }

        fechaHasta.setHours(23, 59, 59, 999);

        filtroFechaVenta.fecha.$lte = fechaHasta;
        filtroFechaGasto.fecha.$lte = fechaHasta;
      }
    }

    // =========================
    // FILTROS
    // =========================

    const filtroVentas = {
      empresaId,
      estado: "pagada",
      ...filtroFechaVenta
    };

    const filtroGastos = {
      empresaId,
      estado: "registrado",
      ...filtroFechaGasto
    };

    if (sedeId) {
      if (!mongoose.Types.ObjectId.isValid(sedeId)) {
        return res.status(400).json({
          ok: false,
          error: "sedeId inválido"
        });
      }

      filtroVentas.sedeId = sedeId;
      filtroGastos.sedeId = sedeId;
    }

    // =========================
    // CONSULTAR DATOS
    // =========================

    const [ventas, gastos] = await Promise.all([
      Venta.find(filtroVentas).lean(),
      Gasto.find(filtroGastos).lean()
    ]);

    // =========================
    // CÁLCULOS FINANCIEROS
    // =========================

    const ingresos = ventas.reduce(
      (total, venta) => total + Number(venta.total || 0),
      0
    );

    const totalGastos = gastos.reduce(
      (total, gasto) => total + Number(gasto.monto || 0),
      0
    );

    const resultado = ingresos - totalGastos;

    const margen =
      ingresos > 0
        ? (resultado / ingresos) * 100
        : 0;

    const ticketPromedio =
      ventas.length > 0
        ? ingresos / ventas.length
        : 0;

    res.json({
      ok: true,

      empresa: {
        id: empresa._id,
        nombre: empresa.nombre
      },

      periodo: {
        desde: desde || null,
        hasta: hasta || null
      },

      resumen: {
        ingresos,
        gastos: totalGastos,
        resultado,
        margen: Number(margen.toFixed(2)),
        numeroVentas: ventas.length,
        numeroGastos: gastos.length,
        ticketPromedio: Number(ticketPromedio.toFixed(2))
      }
    });

  } catch (error) {
    console.error("Error calculando finanzas:", error);

    res.status(500).json({
      ok: false,
      error: "Error calculando resumen financiero"
    });
  }
});

module.exports = router;