const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const Restaurante = require("../models/restaurante");

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});


router.post("/:restaurantId/logo", upload.single("logo"), async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "gruk/logos"
    });

    const restaurante = await Restaurante.findOneAndUpdate(
      { restaurantId: restaurantId },
      {
        logoUrl: result.secure_url
      },
      { returnDocument: "after" }
    );

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado",
        restaurantIdRecibido: restaurantId
      });
    }

    res.json({
      ok: true,
      logoUrl: restaurante.logoUrl,
      restaurante
    });

  } catch (error) {
    console.error("Error subiendo logo:", error);

    res.status(500).json({
      ok: false,
      error: "Error subiendo logo"
    });
  }
});
router.get("/:restaurantId/empresa", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurante = await Restaurante.findOne({
      restaurantId
    }).select("restaurantId nombreRestaurante empresaId");

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    if (!restaurante.empresaId) {
      return res.status(409).json({
        ok: false,
        error: "El restaurante todavía no está vinculado a una empresa"
      });
    }

    res.json({
      ok: true,
      restaurantId: restaurante.restaurantId,
      empresaId: restaurante.empresaId,
      nombreRestaurante: restaurante.nombreRestaurante
    });

  } catch (error) {
    console.error("Error resolviendo empresa del restaurante:", error);

    res.status(500).json({
      ok: false,
      error: "Error obteniendo empresa del restaurante"
    });
  }
});
router.get("/:restaurantId", async (req, res) => {
  
  try {

    const restaurante = await Restaurante.findOne({
      restaurantId: req.params.restaurantId
    });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    res.json({
      ok: true,
      restaurante
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      error: "Error obteniendo restaurante"
    });

  }
});

module.exports = router;