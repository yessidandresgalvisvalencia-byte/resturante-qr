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

module.exports = router;