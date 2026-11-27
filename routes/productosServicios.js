const express = require("express");
const mongoose = require("mongoose");

const ProductoServicio = require("../models/ProductoServicio");
const Empresa = require("../models/Empresa");
const Sede = require("../models/sede");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();
const {catalogScope,resolveCatalogSite,catalogChanges}=require("../core/auth/catalogScope");



// ==========================================
// CREAR PRODUCTO O SERVICIO
// ==========================================

router.post(
  "/",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const {
      empresaId,
      sedeId,
      tipo,
      nombre,
      descripcion,
      categoria,
      sku,
      precioVenta,
      costoUnitario,
      manejaInventario,
      unidad,
      origen,
      metadata
    } = req.body;

    if (!empresaId || !tipo || !nombre || precioVenta === undefined) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    if (String(empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes acceso a crear productos en esta empresa"
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

    if (!["producto", "servicio"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        error: "El tipo debe ser producto o servicio"
      });
    }

    const site = await resolveCatalogSite(req.auth,sedeId,Sede);
    if (!site.ok) return res.status(site.status).json({ok:false,error:site.error});
    const nuevo = new ProductoServicio({
      empresaId,
      sedeId: site.sedeId,
      tipo,
      nombre,
      descripcion: descripcion || "",
      categoria: categoria || "",
      sku: sku || "",
      precioVenta,
      costoUnitario: costoUnitario || 0,

      // Un servicio nunca necesita inventario físico
      manejaInventario:
        tipo === "servicio"
          ? false
          : Boolean(manejaInventario),

      unidad: unidad || "unidad",
      origen: origen || "core",
      metadata: metadata || {}
    });

    await nuevo.save();

    res.status(201).json({
      ok: true,
      productoServicio: nuevo
    });

  } catch (error) {
    console.error("Error creando producto/servicio:", error);

    res.status(500).json({
      ok: false,
      error: "Error creando producto o servicio"
    });
  }
});


// ==========================================
// LISTAR CATÁLOGO DE UNA EMPRESA
// ==========================================

router.get(
  "/empresa/:empresaId",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { tipo, activo } = req.query;

    if (String(empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes acceso al catalogo de esta empresa"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(empresaId)) {
      return res.status(400).json({
        ok: false,
        error: "empresaId inválido"
      });
    }

    const scope = catalogScope(req.auth,false);
    if (!scope) return res.status(403).json({ok:false,error:"Sede no autorizada"});
    const filtro = scope;

    if (tipo !== undefined) {
      if (!["producto","servicio"].includes(tipo)) return res.status(400).json({ok:false,error:"Tipo inválido"});
      filtro.tipo = tipo;
    }

    if (activo !== undefined) {
      filtro.activo = activo === "true";
    }

    const catalogo = await ProductoServicio.find(filtro)
      .sort({ nombre: 1 });

    res.json({
      ok: true,
      cantidad: catalogo.length,
      catalogo
    });

  } catch (error) {
    console.error("Error obteniendo catálogo:", error);

    res.status(500).json({
      ok: false,
      error: "Error obteniendo catálogo"
    });
  }
});


// ==========================================
// ACTUALIZAR PRODUCTO O SERVICIO
// ==========================================

router.put(
  "/:id",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const scope = catalogScope(req.auth,true);
    if (!scope) return res.status(403).json({ok:false,error:"Sede no autorizada"});
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ok:false,error:"ID inválido"});
    const cambios = catalogChanges(req.body);
    if (!cambios) return res.status(400).json({ok:false,error:"Campos de actualización inválidos"});

    if (cambios.tipo === "servicio") {
      cambios.manejaInventario = false;
    }

    const actualizado =
      await ProductoServicio.findOneAndUpdate(
        {
          _id: req.params.id,
          ...scope
        },
        { $set: cambios },
        {
          new: true,
          runValidators: true
        }
      );

    if (!actualizado) {
      return res.status(404).json({
        ok: false,
        error: "Producto o servicio no encontrado"
      });
    }

    res.json({
      ok: true,
      productoServicio: actualizado
    });

  } catch (error) {
    console.error("Error actualizando producto/servicio:", error);

    res.status(500).json({
      ok: false,
      error: "Error actualizando producto o servicio"
    });
  }
});


// ==========================================
// DESACTIVAR SIN BORRAR HISTORIAL
// ==========================================

router.put(
  "/:id/desactivar",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const scope = catalogScope(req.auth,true);
    if (!scope) return res.status(403).json({ok:false,error:"Sede no autorizada"});
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ok:false,error:"ID inválido"});
    const actualizado =
      await ProductoServicio.findOneAndUpdate(
        {
          _id: req.params.id,
          ...scope
        },
        {
          activo: false
        },
        {
          new: true
        }
      );

    if (!actualizado) {
      return res.status(404).json({
        ok: false,
        error: "Producto o servicio no encontrado"
      });
    }

    res.json({
      ok: true,
      productoServicio: actualizado
    });

  } catch (error) {
    console.error("Error desactivando producto/servicio:", error);

    res.status(500).json({
      ok: false,
      error: "Error desactivando producto o servicio"
    });
  }
});


module.exports = router;