const express = require("express");
const mongoose = require("mongoose");

const Gasto = require("../models/Gasto");
const Empresa = require("../models/Empresa");

const router = express.Router();

/*
========================================
CREAR GASTO EMPRESARIAL
========================================
*/
router.post("/", async (req, res) => {
  try {
    const {
      empresaId,
      sedeId,
      concepto,
      categoria,
      monto,
      metodoPago,
      proveedor,
      fecha,
      origen,
      metadata
    } = req.body;

    if (!empresaId || !concepto || !categoria || monto === undefined) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

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

    const montoNumero = Number(monto);

    if (!Number.isFinite(montoNumero) || montoNumero < 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser un número válido"
      });
    }

    const nuevoGasto = new Gasto({
      empresaId,
      sedeId: sedeId || null,
      concepto,
      categoria,
      monto: montoNumero,
      metodoPago: metodoPago || "",
      proveedor: proveedor || "",
      fecha: fecha || new Date(),
      origen: origen || "manual",
      metadata: metadata || {}
    });

    await nuevoGasto.save();

    res.status(201).json({
      ok: true,
      gasto: nuevoGasto
    });

  } catch (error) {
    console.error("Error creando gasto:", error);

    res.status(500).json({
      ok: false,
      error: "Error creando gasto empresarial"
    });
  }
});


/*
========================================
CONSULTAR GASTOS DE UNA EMPRESA
========================================
*/
router.get("/empresa/:empresaId", async (req, res) => {
  try {
    const { empresaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(empresaId)) {
      return res.status(400).json({
        ok: false,
        error: "empresaId inválido"
      });
    }

    const gastos = await Gasto.find({
      empresaId,
      estado: "registrado"
    }).sort({ fecha: -1 });

    const totalGastos = gastos.reduce(
      (total, gasto) => total + gasto.monto,
      0
    );

    res.json({
      ok: true,
      cantidad: gastos.length,
      totalGastos,
      gastos
    });

  } catch (error) {
    console.error("Error consultando gastos:", error);

    res.status(500).json({
      ok: false,
      error: "Error consultando gastos empresariales"
    });
  }
});

module.exports = router;