const express = require("express");
const mongoose = require("mongoose");

const Gasto = require("../models/Gasto");
const Empresa = require("../models/Empresa");
const Sede = require("../models/sede");
const {
  validarGasto,
  validarEstadoPagoGasto
} = require("../core/gastos/validators/gasto.validator");
const {
  registrarGasto,
  actualizarEstadoPagoGasto
} = require("../core/gastos/gastos.service");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();

async function resolverSedeAutorizada({
  auth,
  sedeId
}) {
  if (auth.rol === ROLES_GRUK.ADMIN_SEDE) {
    if (!auth.sedeId) {
      const error = new Error(
        "ADMIN_SEDE requiere una sede autorizada"
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      sedeId &&
      String(sedeId) !==
        String(auth.sedeId)
    ) {
      const error = new Error(
        "No tienes acceso a otra sede"
      );
      error.statusCode = 403;
      throw error;
    }

    return auth.sedeId;
  }

  if (!sedeId) return null;

  if (
    !mongoose.Types.ObjectId.isValid(
      sedeId
    )
  ) {
    const error = new Error(
      "sedeId invalido"
    );
    error.statusCode = 400;
    throw error;
  }

  const sede = await Sede.findOne({
    _id: sedeId,
    empresaId: auth.empresaId
  })
    .select("_id")
    .lean();

  if (!sede) {
    const error = new Error(
      "Sede fuera del tenant autorizado"
    );
    error.statusCode = 403;
    throw error;
  }

  return sede._id;
}

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

    const sedeEfectiva =
      await resolverSedeAutorizada({
        auth: req.auth,
        sedeId: sedeId || null
      });

    const nuevoGasto = await registrarGasto({
      empresaId,
      sedeId: sedeEfectiva,
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

    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    res.status(statusCode).json({
      ok: false,
      error:
        statusCode === 500
          ? "Error creando gasto empresarial"
          : error.message
    });
  }
});


/*
========================================
ACTUALIZAR ESTADO DE PAGO
========================================
*/
router.put(
  "/:id/pago",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          ok: false,
          error: "Gasto invalido"
        });
      }

      const { error, value } =
        validarEstadoPagoGasto(req.body);

      if (error) {
        return res.status(400).json({
          ok: false,
          error: "Estado de pago invalido"
        });
      }

      const sedeEfectiva =
        await resolverSedeAutorizada({
          auth: req.auth,
          sedeId:
            req.auth.rol === ROLES_GRUK.ADMIN_SEDE
              ? req.auth.sedeId
              : null
        });

      const gasto =
        await actualizarEstadoPagoGasto({
          gastoId: req.params.id,
          empresaId: req.auth.empresaId,
          sedeId: sedeEfectiva,
          estadoPago: value.estadoPago
        });

      return res.json({
        ok: true,
        gasto
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error.statusCode)
          ? error.statusCode
          : 500;

      console.error(
        "Error actualizando pago de gasto:",
        error
      );

      return res.status(statusCode).json({
        ok: false,
        error:
          statusCode === 404
            ? "Gasto no encontrado"
            : "Error actualizando estado de pago"
      });
    }
  }
);


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

    const filtroGastos = {
      empresaId,
      estado: "registrado"
    };

    if (
      req.auth.rol === ROLES_GRUK.ADMIN_SEDE
    ) {
      if (!req.auth.sedeId) {
        return res.status(403).json({
          ok: false,
          error: "ADMIN_SEDE requiere una sede autorizada"
        });
      }

      filtroGastos.sedeId =
        req.auth.sedeId;
    }

    const gastos = await Gasto.find(
      filtroGastos
    ).sort({ fecha: -1 });

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