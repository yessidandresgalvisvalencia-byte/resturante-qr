const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Receta = require("../models/Receta");
const Restaurante = require("../models/restaurante");

const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

/*
 * ============================================================
 * SEGURIDAD GRUK
 * ============================================================
 *
 * Toda operación administrativa de recetas:
 *   JWT -> rol -> tenant
 *
 * El tenant SIEMPRE sale de req.auth.empresaId.
 */

async function validarRestaurantTenant(restaurantId, empresaId) {
  if (!restaurantId || !empresaId) {
    return false;
  }

  const restaurante = await Restaurante.findOne({
    restaurantId: String(restaurantId),
    empresaId
  })
    .select("_id")
    .lean();

  return Boolean(restaurante);
}

const seguridadRecetas = [
  authMiddleware,
  roleCheck(
    ROLES_GRUK.DUENO,
    ROLES_GRUK.ADMIN_SEDE
  )
];


/*
 * ============================================================
 * CREAR RECETA
 * ============================================================
 */
router.post(
  "/",
  ...seguridadRecetas,
  async (req, res) => {
    try {
      const body = req.body || {};

      const {
        restaurantId
      } = body;

      if (!restaurantId) {
        return res.status(400).json({
          ok: false,
          mensaje: "restaurantId es obligatorio."
        });
      }

      const pertenece = await validarRestaurantTenant(
        restaurantId,
        req.auth.empresaId
      );

      if (!pertenece) {
        return res.status(403).json({
          ok: false,
          mensaje: "Restaurante no autorizado para esta empresa."
        });
      }

      /*
       * Nunca aceptamos empresaId enviado por el cliente
       * como autoridad del tenant.
       */
      const datos = {
        ...body,
        restaurantId,
        codigo:
          body.codigo ||
          `REC-${Date.now()}`
      };

      delete datos.empresaId;

      const receta = await Receta.create(datos);

      return res.status(201).json({
        ok: true,
        mensaje: "Receta guardada correctamente.",
        receta
      });

    } catch (error) {
      console.error(
        "Error guardando receta:",
        error
      );

      return res.status(500).json({
        ok: false,
        mensaje: "Error interno guardando receta."
      });
    }
  }
);


/*
 * ============================================================
 * LISTAR RECETAS POR RESTAURANTE
 * ============================================================
 */
router.get(
  "/:restaurantId",
  ...seguridadRecetas,
  async (req, res) => {
    try {
      const {
        restaurantId
      } = req.params;

      const pertenece = await validarRestaurantTenant(
        restaurantId,
        req.auth.empresaId
      );

      if (!pertenece) {
        return res.status(403).json({
          ok: false,
          mensaje: "Restaurante no autorizado para esta empresa."
        });
      }

      const recetas = await Receta.find({
        restaurantId,
        activa: true
      })
        .sort({
          createdAt: -1
        });

      return res.json({
        ok: true,
        recetas
      });

    } catch (error) {
      console.error(
        "Error listando recetas:",
        error
      );

      return res.status(500).json({
        ok: false,
        mensaje: "Error interno listando recetas."
      });
    }
  }
);


/*
 * ============================================================
 * OBTENER UNA RECETA
 * ============================================================
 */
router.get(
  "/detalle/:id",
  ...seguridadRecetas,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          ok: false,
          mensaje: "ID de receta inválido."
        });
      }

      const receta = await Receta.findById(
        req.params.id
      );

      if (!receta) {
        return res.status(404).json({
          ok: false,
          mensaje: "Receta no encontrada."
        });
      }

      const pertenece = await validarRestaurantTenant(
        receta.restaurantId,
        req.auth.empresaId
      );

      if (!pertenece) {
        return res.status(403).json({
          ok: false,
          mensaje: "Receta no autorizada para esta empresa."
        });
      }

      return res.json({
        ok: true,
        receta
      });

    } catch (error) {
      console.error(
        "Error obteniendo receta:",
        error
      );

      return res.status(500).json({
        ok: false,
        mensaje: "Error interno obteniendo receta."
      });
    }
  }
);


/*
 * ============================================================
 * DUPLICAR RECETA
 * ============================================================
 */
router.post(
  "/duplicar/:id",
  ...seguridadRecetas,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          ok: false,
          mensaje: "ID de receta inválido."
        });
      }

      const receta = await Receta.findById(
        req.params.id
      ).lean();

      if (!receta) {
        return res.status(404).json({
          ok: false,
          mensaje: "Receta no encontrada."
        });
      }

      const pertenece = await validarRestaurantTenant(
        receta.restaurantId,
        req.auth.empresaId
      );

      if (!pertenece) {
        return res.status(403).json({
          ok: false,
          mensaje: "Receta no autorizada para esta empresa."
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

      return res.json({
        ok: true,
        mensaje: "Receta duplicada correctamente.",
        receta: copia
      });

    } catch (error) {
      console.error(
        "Error duplicando receta:",
        error
      );

      return res.status(500).json({
        ok: false,
        mensaje: "Error interno duplicando receta."
      });
    }
  }
);


/*
 * ============================================================
 * ELIMINACIÓN LÓGICA
 * ============================================================
 *
 * IMPORTANTE:
 * Nunca usamos findByIdAndUpdate().
 *
 * Primero obtenemos la receta, verificamos tenant,
 * y luego hacemos update condicionado por _id + restaurantId.
 */
router.delete(
  "/:id",
  ...seguridadRecetas,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          ok: false,
          mensaje: "ID de receta inválido."
        });
      }

      const recetaExistente =
        await Receta.findById(
          req.params.id
        ).lean();

      if (!recetaExistente) {
        return res.status(404).json({
          ok: false,
          mensaje: "Receta no encontrada."
        });
      }

      const pertenece =
        await validarRestaurantTenant(
          recetaExistente.restaurantId,
          req.auth.empresaId
        );

      if (!pertenece) {
        return res.status(403).json({
          ok: false,
          mensaje: "Receta no autorizada para esta empresa."
        });
      }

      const receta =
        await Receta.findOneAndUpdate(
          {
            _id: req.params.id,
            restaurantId:
              recetaExistente.restaurantId
          },
          {
            activa: false
          },
          {
            new: true
          }
        );

      if (!receta) {
        return res.status(404).json({
          ok: false,
          mensaje: "Receta no encontrada."
        });
      }

      return res.json({
        ok: true,
        mensaje: "Receta eliminada correctamente."
      });

    } catch (error) {
      console.error(
        "Error eliminando receta:",
        error
      );

      return res.status(500).json({
        ok: false,
        mensaje: "Error interno eliminando receta."
      });
    }
  }
);


module.exports = router;
