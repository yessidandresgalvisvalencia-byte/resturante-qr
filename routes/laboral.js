const express = require("express");
const router = express.Router();
const ia = require("../gruk-ai");
const EmpleadoLaboral = require("../models/EmpleadoLaboral");
const SolicitudLaboral = require("../models/SolicitudLaboral");

// CREAR EMPLEADO
router.post("/empleados", async (req, res) => {
  try {
    const {
      restaurantId,
      nombre,
      documento,
      cargo,
      area,
      telefono,
      correo,
      contrato,
      salario,
      valorHora,
      fotoBase
    } = req.body;

    if (!restaurantId || !nombre || !documento || !cargo || !area) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos obligatorios del empleado."
      });
    }

    const salarioNum = Number(salario || 0);

    let valorHoraNum = Number(valorHora || 0);

    if (valorHoraNum <= 0 && salarioNum > 0) {
      valorHoraNum = Math.round(salarioNum / 240);
    }

    const empleado = await EmpleadoLaboral.create({
      restaurantId,
      nombre,
      documento,
      cargo,
      area,
      telefono,
      correo,
      contrato,
      salario: salarioNum,
      valorHora: valorHoraNum,
      fotoBase,
      activo: true
    });

    res.json({
      ok: true,
      mensaje: "Empleado creado correctamente.",
      empleado
    });

   } catch (error) {
    console.error("Error creando empleado laboral:", error);
    console.error("STACK:", error.stack);

    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        mensaje: "Ya existe un empleado con ese documento en este restaurante."
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: error.message || "Error interno creando empleado laboral."
    });
  }
});

// LISTAR EMPLEADOS
router.get("/empleados/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const empleados = await EmpleadoLaboral.find({ restaurantId })
      .sort({ createdAt: -1 });

    res.json({
      ok: true,
      empleados
    });

  } catch (error) {
    console.error("Error listando empleados laborales:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando empleados."
    });
  }
});

// CAMBIAR ESTADO ACTIVO / INACTIVO
router.put("/empleados/:id/estado", async (req, res) => {
  try {
    const empleado = await EmpleadoLaboral.findById(req.params.id);

    if (!empleado) {
      return res.status(404).json({
        ok: false,
        mensaje: "Empleado no encontrado."
      });
    }

    empleado.activo = !empleado.activo;

    await empleado.save();

    res.json({
      ok: true,
      mensaje: "Estado actualizado.",
      empleado
    });

  } catch (error) {
    console.error("Error cambiando estado empleado:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno cambiando estado."
    });
  }
});

// ELIMINAR EMPLEADO
router.delete("/empleados/:id", async (req, res) => {
  try {
    const empleado = await EmpleadoLaboral.findByIdAndDelete(req.params.id);

    if (!empleado) {
      return res.status(404).json({
        ok: false,
        mensaje: "Empleado no encontrado."
      });
    }

    res.json({
      ok: true,
      mensaje: "Empleado eliminado correctamente."
    });

  } catch (error) {
    console.error("Error eliminando empleado:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno eliminando empleado."
    });
  }
});
router.post("/reconocer", async (req, res) => {
  try {
    console.log("LLEGÓ A /laboral/reconocer");
console.log("BODY:", req.body);
    const { restaurantId, selfie } = req.body;

    if (!restaurantId || !selfie) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan restaurantId o selfie."
      });
    }

    const empleados = await EmpleadoLaboral.find({
      restaurantId,
      activo: true
    }).lean();
    console.log("Empleados encontrados:", empleados.length);

empleados.forEach(e => {
  console.log("Empleado:", e.nombre, "fotoBase existe:", !!e.fotoBase);
});

    const resultado = await ia.reconocimiento.reconocerEmpleado({
  restaurantId,
  selfie,
  empleados
});

    res.json(resultado);

  } catch (error) {
    console.error("Error en /laboral/reconocer:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error reconociendo empleado."
    });
  }
});
// CREAR SOLICITUD LABORAL
router.post("/solicitudes", async (req, res) => {
  try {
    const {
      restaurantId,
      empleadoId,
      empleadoNombre,
      tipo
    } = req.body;

    if (!restaurantId || !empleadoId || !tipo) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos obligatorios de la solicitud."
      });
    }

    const solicitud = await SolicitudLaboral.create({
      restaurantId,
      empleadoId,
      empleadoNombre,
      tipo,
      estado: "pendiente"
    });

    res.json({
      ok: true,
      mensaje: "Solicitud enviada correctamente.",
      solicitud
    });

  } catch (error) {
    console.error("Error creando solicitud laboral:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno creando solicitud laboral."
    });
  }
});

// LISTAR SOLICITUDES POR RESTAURANTE
router.get("/solicitudes/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const solicitudes = await SolicitudLaboral.find({ restaurantId })
      .sort({ createdAt: -1 });

    res.json({
      ok: true,
      solicitudes
    });

  } catch (error) {
    console.error("Error listando solicitudes:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando solicitudes."
    });
  }
});

// CAMBIAR ESTADO DE SOLICITUD
router.put("/solicitudes/:id/estado", async (req, res) => {
  try {
    const { estado, observacion } = req.body;

    if (!["pendiente", "aprobada", "rechazada"].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: "Estado inválido."
      });
    }

    const solicitud = await SolicitudLaboral.findByIdAndUpdate(
      req.params.id,
      {
        estado,
        observacion: observacion || ""
      },
      { new: true }
    );

    if (!solicitud) {
      return res.status(404).json({
        ok: false,
        mensaje: "Solicitud no encontrada."
      });
    }

    res.json({
      ok: true,
      mensaje: "Solicitud actualizada correctamente.",
      solicitud
    });

  } catch (error) {
    console.error("Error actualizando solicitud:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno actualizando solicitud."
    });
  }
});
module.exports = router;