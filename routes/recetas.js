const express = require("express");
const router = express.Router();
const Receta = require("../models/Receta");

// CREAR RECETA
router.post("/", async (req, res) => {
  try {
    const receta = await Receta.create({
      ...req.body,
      codigo: req.body.codigo || `REC-${Date.now()}`
    });

    res.json({
      ok: true,
      mensaje: "Receta guardada correctamente.",
      receta
    });

  } catch (error) {
    console.error("Error guardando receta:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno guardando receta."
    });
  }
});

// LISTAR RECETAS POR RESTAURANTE
router.get("/:restaurantId", async (req, res) => {
  try {
    const recetas = await Receta.find({
      restaurantId: req.params.restaurantId,
      activa: true
    }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      recetas
    });

  } catch (error) {
    console.error("Error listando recetas:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando recetas."
    });
  }
});

// OBTENER UNA RECETA
router.get("/detalle/:id", async (req, res) => {
  try {
    const receta = await Receta.findById(req.params.id);

    if (!receta) {
      return res.status(404).json({
        ok: false,
        mensaje: "Receta no encontrada."
      });
    }

    res.json({
      ok: true,
      receta
    });

  } catch (error) {
    console.error("Error obteniendo receta:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno obteniendo receta."
    });
  }
});

// DUPLICAR RECETA
router.post("/duplicar/:id", async (req, res) => {
  try {
    const receta = await Receta.findById(req.params.id).lean();

    if (!receta) {
      return res.status(404).json({
        ok: false,
        mensaje: "Receta no encontrada."
      });
    }

    delete receta._id;
    delete receta.createdAt;
    delete receta.updatedAt;
    delete receta.__v;

    const copia = await Receta.create({
      ...receta,
      codigo: `REC-${Date.now()}`,
      nombre: `${receta.nombre} copia`
    });

    res.json({
      ok: true,
      mensaje: "Receta duplicada correctamente.",
      receta: copia
    });

  } catch (error) {
    console.error("Error duplicando receta:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno duplicando receta."
    });
  }
});

// ELIMINAR LÓGICO
router.delete("/:id", async (req, res) => {
  try {
    const receta = await Receta.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    );

    if (!receta) {
      return res.status(404).json({
        ok: false,
        mensaje: "Receta no encontrada."
      });
    }

    res.json({
      ok: true,
      mensaje: "Receta eliminada correctamente."
    });

  } catch (error) {
    console.error("Error eliminando receta:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno eliminando receta."
    });
  }
});

module.exports = router;