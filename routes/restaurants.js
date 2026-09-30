const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const Restaurante = require("../models/restaurante");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const permitidos = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!permitidos.has(file.mimetype)) return cb(new Error("TIPO_ARCHIVO_NO_PERMITIDO"));
    return cb(null, true);
  }
});


router.post("/:restaurantId/logo", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), upload.single("logo"), async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "gruk/logos"
    });

    const restaurante = await Restaurante.findOneAndUpdate(
      { restaurantId: restaurantId, empresaId: req.auth.empresaId },
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
      logoUrl: restaurante.logoUrl
    });

  } catch (error) {
    console.error("Error subiendo logo:", error);

    res.status(500).json({
      ok: false,
      error: "Error subiendo logo"
    });
  }
});
router.get(
  "/:restaurantId/empresa",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurante = await Restaurante.findOne({
      restaurantId,
      empresaId: req.auth.empresaId
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
    }).select("restaurantId nombreRestaurante logoUrl primaryColor").lean();

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    res.json({
      ok: true,
      restaurante: {
        restaurantId: restaurante.restaurantId,
        nombreRestaurante: restaurante.nombreRestaurante,
        logoUrl: restaurante.logoUrl || "",
        primaryColor: restaurante.primaryColor || "#ff6600"
      }
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      error: "Error obteniendo restaurante"
    });

  }
});

module.exports = router;