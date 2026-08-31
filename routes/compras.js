const express = require("express");
const mongoose = require("mongoose");

const Compra = require("../models/Compra");
const Empresa = require("../models/Empresa");
const ProductoServicio = require("../models/ProductoServicio");
const Inventario = require("../models/Inventario");
const MovimientoInventario = require("../models/MovimientoInventario");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");

const router = express.Router();


// ==========================================
// CREAR COMPRA
// ==========================================

router.post(
  "/",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      empresaId,
      sedeId,
      proveedor,
      numeroDocumento,
      items,
      impuestos,
      metodoPago,
      estadoPago,
      fecha,
      observaciones,
      origen,
      metadata
    } = req.body;

    // ==========================================
    // VALIDACIONES GENERALES
    // ==========================================

    if (!empresaId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "empresaId e items son obligatorios"
      });
    }

    if (String(empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({
        ok: false,
        error: "No tienes acceso a registrar compras en esta empresa"
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

    const itemsProcesados = [];

    // ==========================================
    // VALIDAR ITEMS ANTES DE LA TRANSACCIÓN
    // ==========================================

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      const costoUnitario = Number(item.costoUnitario);

      if (
        !item.nombre ||
        !Number.isFinite(cantidad) ||
        cantidad <= 0 ||
        !Number.isFinite(costoUnitario) ||
        costoUnitario < 0
      ) {
        return res.status(400).json({
          ok: false,
          error: "Hay items de compra inválidos"
        });
      }

      let producto = null;

      if (item.productoServicioId) {
        if (!mongoose.Types.ObjectId.isValid(item.productoServicioId)) {
          return res.status(400).json({
            ok: false,
            error: "productoServicioId inválido"
          });
        }

        producto = await ProductoServicio.findOne({
          _id: item.productoServicioId,
          empresaId
        });

        if (!producto) {
          return res.status(404).json({
            ok: false,
            error:
              "El producto/servicio no existe o pertenece a otra empresa"
          });
        }
      }

      itemsProcesados.push({
        productoServicioId: producto ? producto._id : null,
        producto,
        nombre: item.nombre,
        cantidad,
        costoUnitario,
        subtotal: cantidad * costoUnitario,
        unidad: item.unidad || "unidad"
      });
    }

    const subtotal = itemsProcesados.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    const impuestosNumero = Number(impuestos || 0);

    if (
      !Number.isFinite(impuestosNumero) ||
      impuestosNumero < 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Impuestos inválidos"
      });
    }

    const total = subtotal + impuestosNumero;

    let compraCreada = null;

    // ==========================================
    // TRANSACCIÓN
    // ==========================================

    await session.withTransaction(async () => {

      // 1. CREAR COMPRA
      const compras = await Compra.create(
        [
          {
            empresaId,
            sedeId: sedeId || null,
            proveedor: proveedor || "",
            numeroDocumento: numeroDocumento || "",

            items: itemsProcesados.map(item => ({
              productoServicioId: item.productoServicioId,
              nombre: item.nombre,
              cantidad: item.cantidad,
              costoUnitario: item.costoUnitario,
              subtotal: item.subtotal,
              unidad: item.unidad
            })),

            subtotal,
            impuestos: impuestosNumero,
            total,
            metodoPago: metodoPago || "efectivo",
            estadoPago: estadoPago || "pagado",
            fecha: fecha || new Date(),
            observaciones: observaciones || "",
            origen: origen || "manual",
            metadata: metadata || {}
          }
        ],
        { session }
      );

      compraCreada = compras[0];

      // ==========================================
      // 2. ACTUALIZAR INVENTARIO
      // ==========================================

      for (const item of itemsProcesados) {

        // Items sin catálogo vinculado no modifican inventario.
        if (!item.producto) {
          continue;
        }

        // Servicios nunca modifican inventario.
        if (
          item.producto.tipo !== "producto" ||
          !item.producto.manejaInventario
        ) {
          continue;
        }

        const filtroInventario = {
          empresaId,
          productoServicioId: item.producto._id,
          sedeId: sedeId || null,
          anulado: false
        };

        let inventario = await Inventario.findOne(
          filtroInventario
        ).session(session);

        let stockAnterior = 0;

        if (inventario) {
          stockAnterior = Number(inventario.cantidad || 0);

          const costoAnterior = Number(inventario.costo || 0);

const valorInventarioAnterior =
  stockAnterior * costoAnterior;

const valorNuevaCompra =
  item.cantidad * item.costoUnitario;

const stockNuevoCalculado =
  stockAnterior + item.cantidad;

const costoPromedioPonderado =
  stockNuevoCalculado > 0
    ? (valorInventarioAnterior + valorNuevaCompra) /
      stockNuevoCalculado
    : 0;

inventario.cantidad = stockNuevoCalculado;
inventario.costo = costoPromedioPonderado;
          inventario.fechaCompra =
            fecha ? new Date(fecha) : new Date();

          await inventario.save({ session });

        } else {

          const inventarios = await Inventario.create(
            [
              {
                empresaId,
                sedeId: sedeId || null,
                productoServicioId: item.producto._id,

                // CORE puro: no necesitamos restaurantId.
                restaurantId: null,

                nombre: item.producto.nombre,
                categoria:
                  item.producto.categoria || "Sin categoría",

                cantidad: item.cantidad,
                costo: item.costoUnitario,
                unidad:
                  item.unidad ||
                  item.producto.unidad ||
                  "unidad",

                proveedor: proveedor || "",
                fechaCompra:
                  fecha ? new Date(fecha) : new Date(),

                estado: "vigente",
                prioridad: "media"
              }
            ],
            { session }
          );

          inventario = inventarios[0];
        }

        const stockNuevo = Number(inventario.cantidad);

        // ==========================================
        // 3. REGISTRAR TRAZABILIDAD
        // ==========================================

        await MovimientoInventario.create(
          [
            {
              empresaId,
              sedeId: sedeId || null,
              productoServicioId: item.producto._id,
              inventarioId: inventario._id,

              tipo: "entrada",
              motivo: "compra",

              cantidad: item.cantidad,
              stockAnterior,
              stockNuevo,

              costoUnitario: item.costoUnitario,

              referenciaTipo: "Compra",
              referenciaId: compraCreada._id,

              observaciones:
                `Entrada generada por compra ${
                  numeroDocumento || compraCreada._id
                }`
            }
          ],
          { session }
        );
      }
    });

    res.status(201).json({
      ok: true,
      compra: compraCreada,
      inventarioProcesado: true
    });

  } catch (error) {
    console.error(
      "Error creando compra transaccional:",
      error
    );

    res.status(500).json({
      ok: false,
      error: "Error creando compra"
    });

  } finally {
    await session.endSession();
  }
});

// ==========================================
// LISTAR COMPRAS DE UNA EMPRESA
// ==========================================

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
        error: "No tienes acceso a las compras de esta empresa"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(empresaId)) {
      return res.status(400).json({
        ok: false,
        error: "empresaId inválido"
      });
    }

    const compras = await Compra.find({
      empresaId,
      estado: "registrada"
    }).sort({
      fecha: -1
    });

    const totalCompras = compras.reduce(
      (total, compra) => total + compra.total,
      0
    );

    res.json({
      ok: true,
      cantidad: compras.length,
      totalCompras,
      compras
    });

  } catch (error) {
    console.error("Error obteniendo compras:", error);

    res.status(500).json({
      ok: false,
      error: "Error obteniendo compras"
    });
  }
});


// ==========================================
// ANULAR COMPRA
// ==========================================

router.put(
  "/:id/anular",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        ok: false,
        error: "ID de compra inválido"
      });
    }

    const compra = await Compra.findOneAndUpdate(
      {
        _id: req.params.id,
        empresaId: req.auth.empresaId
      },
      {
        estado: "anulada"
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!compra) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada"
      });
    }

    res.json({
      ok: true,
      compra
    });

  } catch (error) {
    console.error("Error anulando compra:", error);

    res.status(500).json({
      ok: false,
      error: "Error anulando compra"
    });
  }
});


module.exports = router;