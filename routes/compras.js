const express = require("express");
const mongoose = require("mongoose");
const Joi = require("joi");

const Compra = require("../models/Compra");
const Empresa = require("../models/Empresa");
const Sede = require("../models/sede");
const ProductoServicio = require("../models/ProductoServicio");
const Inventario = require("../models/Inventario");
const MovimientoInventario = require("../models/MovimientoInventario");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const eventBus = require("../core/eventos/eventBus");

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

    const sedeEfectiva =
      await resolverSedeAutorizada({
        auth: req.auth,
        sedeId: sedeId || null
      });

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
            sedeId: sedeEfectiva,
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
          sedeId: sedeEfectiva,
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
                sedeId: sedeEfectiva,
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
              sedeId: sedeEfectiva,
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

    // GRUK: el evento nace solo despues de confirmar la transaccion.
    // Si estadoPago no es "pagado", la Junta lo registra como compromiso,
    // nunca como salida confirmada de caja.
    try {
      eventBus.emit("COMPRA_REGISTRADA", {
        compraId: compraCreada._id,
        empresaId: compraCreada.empresaId,
        sedeId: compraCreada.sedeId,
        proveedor: compraCreada.proveedor,
        total: compraCreada.total,
        metodoPago: compraCreada.metodoPago,
        estadoPago: compraCreada.estadoPago,
        fecha: compraCreada.fecha,
        sourceUpdatedAt:
          compraCreada.updatedAt,
        cajaReferencia:
          compraCreada.metadata?.cajaReferencia || null
      });
    } catch (eventError) {
      console.error(
        "[GRUK COMPRAS] compra persistida, fallo al emitir COMPRA_REGISTRADA:",
        eventError
      );
    }

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

    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    res.status(statusCode).json({
      ok: false,
      error:
        statusCode === 500
          ? "Error creando compra"
          : error.message
    });

  } finally {
    await session.endSession();
  }
});

// ==========================================
// ACTUALIZAR ESTADO DE PAGO DE COMPRA
// ==========================================

const estadoPagoCompraSchema = Joi.object({
  estadoPago: Joi.string()
    .valid(
      "pendiente",
      "parcial",
      "pagado"
    )
    .required()
}).required();

router.put(
  "/:id/pago",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: "ID de compra invalido"
        });
      }

      const { error, value } =
        estadoPagoCompraSchema.validate(
          req.body,
          {
            abortEarly: false,
            stripUnknown: true
          }
        );

      if (error) {
        return res.status(400).json({
          ok: false,
          error: "Estado de pago invalido"
        });
      }

      const filtro = {
        _id: req.params.id,
        empresaId: req.auth.empresaId,
        estado: "registrada"
      };

      if (
        req.auth.rol ===
        ROLES_GRUK.ADMIN_SEDE
      ) {
        if (!req.auth.sedeId) {
          return res.status(403).json({
            ok: false,
            error:
              "ADMIN_SEDE requiere una sede autorizada"
          });
        }

        filtro.sedeId =
          req.auth.sedeId;
      }

      const compra =
        await Compra.findOne(filtro);

      if (!compra) {
        return res.status(404).json({
          ok: false,
          error: "Compra no encontrada"
        });
      }

      const estadoAnterior =
        compra.estadoPago;

      if (
        estadoAnterior !==
        value.estadoPago
      ) {
        compra.estadoPago =
          value.estadoPago;

        await compra.save();

        try {
          eventBus.emit(
            "COMPRA_PAGO_ACTUALIZADO",
            {
              compraId: compra._id,
              empresaId:
                compra.empresaId,
              sedeId: compra.sedeId,
              proveedor:
                compra.proveedor,
              total: compra.total,
              metodoPago:
                compra.metodoPago,
              estadoPagoAnterior:
                estadoAnterior,
              estadoPago:
                compra.estadoPago,
              fecha: compra.fecha,
              sourceUpdatedAt:
                compra.updatedAt,
              cajaReferencia:
                compra.metadata?.cajaReferencia || null
            }
          );
        } catch (eventError) {
          console.error(
            "[GRUK COMPRAS] pago persistido, fallo al emitir COMPRA_PAGO_ACTUALIZADO:",
            eventError
          );
        }
      }

      return res.json({
        ok: true,
        compra
      });
    } catch (error) {
      console.error(
        "Error actualizando pago de compra:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error actualizando estado de pago"
      });
    }
  }
);


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

    const filtroCompras = {
      empresaId,
      estado: "registrada"
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

      filtroCompras.sedeId =
        req.auth.sedeId;
    }

    const compras = await Compra.find(
      filtroCompras
    ).sort({
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

    const filtroCompra = {
      _id: req.params.id,
      empresaId: req.auth.empresaId
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

      filtroCompra.sedeId =
        req.auth.sedeId;
    }

    const compra = await Compra.findOneAndUpdate(
      filtroCompra,
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