const express = require("express");
const mongoose = require("mongoose");

const Gasto = require("../models/Gasto");
const Empresa = require("../models/Empresa");
const {
  validarGasto
} = require("../core/gastos/validators/gasto.validator");
const {
  registrarGasto
} = require("../core/gastos/gastos.service");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();

/*
========================================
CREAR GASTO EMPRESARIAL
========================================
*/
router.post(
  "/",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const { error, value } = validarGasto(req.body);

    if (error) {
      return res.status(400).json({
        ok: false,
        error: "Datos de gasto invalidos",
        detalles: error.details.map(detalle => detalle.message)
      });
    }

    const {
      empresaId,
      sedeId,
      concepto,
      categoria,
      monto,
      metodoPago,
      estadoPago,
      proveedor,
      fecha,
      origen,
      metadata
    } = value;


    if (String(empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes acceso a registrar gastos en esta empresa"
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

    const nuevoGasto = await registrarGasto({
      empresaId,
      sedeId: sedeId || null,
      concepto,
      categoria,
      monto,
      metodoPago: metodoPago || "",
      estadoPago: estadoPago || "desconocido",
      proveedor: proveedor || "",
      fecha: fecha || new Date(),
      origen: origen || "manual",
      metadata: metadata || {}
    });

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
router.get(
  "/empresa/:empresaId",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const { empresaId } = req.params;

    if (String(empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes acceso a los gastos de esta empresa"
      });
    }

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