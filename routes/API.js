const express = require("express");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const axios = require("axios");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const router = express.Router();

const Pedido = require("../models/pedido.js");
const Llamado = require("../models/llamado");
const Restaurante = require("../models/restaurante");
const Usuario = require("../models/usuario");
const Sede = require("../models/sede");
const Empresa = require("../models/Empresa");
const {
  registrarVentaDesdePedido
} = require("../services/ventas.service");
const ProductoServicio = require("../models/ProductoServicio");


/* =========================
   CONFIG BÁSICA
========================= */

function menuBase() {
  return [
    {
      id: 1,
      nombre: "Hamburguesa clásica",
      categoria: "Hamburguesas",
      precio: 20000,
      imagen: "/img/hamburguesa.jpg",
      disponible: true,
      tiempoBase: 15
    },
    {
      id: 2,
      nombre: "Pizza personal",
      categoria: "Pizzas",
      precio: 30000,
      imagen: "/img/pizza.jpg",
      disponible: true,
      tiempoBase: 20
    },
    {
      id: 3,
      nombre: "Gaseosa",
      categoria: "Bebidas",
      precio: 5000,
      imagen: "/img/gaseosa.jpg",
      disponible: true,
      tiempoBase: 2
    },
    {
      id: 4,
      nombre: "Perro caliente",
      categoria: "Comida rápida",
      precio: 18000,
      imagen: "/img/perro.jpg",
      disponible: true,
      tiempoBase: 12
    },
    {
      id: 5,
      nombre: "Papas especiales",
      categoria: "Acompañamientos",
      precio: 12000,
      imagen: "/img/papas.jpg",
      disponible: true,
      tiempoBase: 10
    },
    {
      id: 6,
      nombre: "Helado",
      categoria: "Postres",
      precio: 9000,
      imagen: "/img/helado.jpg",
      disponible: true,
      tiempoBase: 3
    }
  ];
}

const menusPorRestaurante = {
  rest1: menuBase()
};

function getRestaurantId(req) {
  return req.query.restaurantId || req.body.restaurantId || "rest1";
}

function getMenu(restaurantId) {
  if (!menusPorRestaurante[restaurantId]) {
    menusPorRestaurante[restaurantId] = menuBase();
  }
  return menusPorRestaurante[restaurantId];
}

/* =========================
   MENU
========================= */

router.get("/menu", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const Menu = require("../models/menu");

    const menu = await Menu.find({ restaurantId });
    res.json(menu);
  } catch (error) {
    console.log("Error obteniendo menú:", error);
    res.status(500).json([]);
  }
});

router.post("/menu", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      restaurantId,
      nombre,
      descripcion,
      precio,
      costoMateriaPrima,
      categoria,
      guarniciones,
      extras,
      imagen,
      tiempoBase,
      disponible
    } = req.body;

    // =====================================================
    // GRUK — VALIDACIÓN DE ENTRADA
    // =====================================================

    if (
      !restaurantId ||
      !nombre ||
      precio === undefined ||
      precio === null ||
      !categoria
    ) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const precioNumerico = Number(precio);
    const costoNumerico = Number(costoMateriaPrima || 0);
    const tiempoNumerico = Number(tiempoBase || 10);

    if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
      return res.status(400).json({
        ok: false,
        error: "El precio del producto no es válido"
      });
    }

    if (!Number.isFinite(costoNumerico) || costoNumerico < 0) {
      return res.status(400).json({
        ok: false,
        error: "El costo de materia prima no es válido"
      });
    }

    if (!Number.isFinite(tiempoNumerico) || tiempoNumerico < 0) {
      return res.status(400).json({
        ok: false,
        error: "El tiempo base no es válido"
      });
    }

    const Menu = require("../models/menu");

    let nuevoProducto = null;

    // =====================================================
    // GRUK — UNIDAD ATÓMICA CORE + RESTAURANTE
    // =====================================================

    await session.withTransaction(async () => {

      // ===================================================
      // 1. RESOLVER PROPIEDAD EMPRESARIAL
      // ===================================================

      const restaurante = await Restaurante.findOne({
        restaurantId
      })
        .select("_id restaurantId empresaId")
        .session(session);

      if (!restaurante) {
        const error = new Error("Restaurante no encontrado");
        error.statusCode = 404;
        throw error;
      }

      if (!restaurante.empresaId) {
        const error = new Error(
          "El restaurante todavía no está vinculado a una empresa"
        );
        error.statusCode = 409;
        throw error;
      }

      // ===================================================
      // 2. GENERAR IDENTIFICADOR DE LA VERTICAL
      // ===================================================

      const ultimoProducto = await Menu.findOne({
        restaurantId
      })
        .sort({ id: -1 })
        .session(session);

      const nuevoId =
        ultimoProducto
          ? Number(ultimoProducto.id) + 1
          : 1;

      // ===================================================
      // 3. CREAR IDENTIDAD ECONÓMICA EN GRUK CORE
      // ===================================================

      const productosCore = await ProductoServicio.create(
        [
          {
            empresaId: restaurante.empresaId,
            sedeId: null,

            tipo: "producto",

            nombre: String(nombre).trim(),
            descripcion: String(descripcion || "").trim(),
            categoria: String(categoria).trim(),

            precioVenta: precioNumerico,
            costoUnitario: costoNumerico,

            manejaInventario: false,
            unidad: "unidad",

            activo: true,
            origen: "restaurante",

            metadata: {
              restaurantId,
              menuId: nuevoId
            }
          }
        ],
        {
          session
        }
      );

      const productoCore = productosCore[0];

      if (!productoCore) {
        throw new Error(
          "No fue posible crear la identidad económica del producto"
        );
      }
      // ===================================================
      // 4. CREAR REPRESENTACIÓN EN GRUK RESTAURANTES
      // ===================================================

      const productosMenu = await Menu.create(
        [
          {
            restaurantId,
            id: nuevoId,

            productoServicioId: productoCore._id,

            nombre: String(nombre).trim(),
            descripcion: String(descripcion || "").trim(),

            precio: precioNumerico,
            costoMateriaPrima: costoNumerico,

            categoria: String(categoria).trim(),

            guarniciones:
              Array.isArray(guarniciones)
                ? guarniciones
                : [],

            extras:
              Array.isArray(extras)
                ? extras
                : [],

            imagen: String(imagen || ""),

            tiempoBase: tiempoNumerico,

            disponible:
              disponible === true ||
              disponible === "true"
          }
        ],
        {
          session
        }
      );

      nuevoProducto = productosMenu[0];

      if (!nuevoProducto) {
        throw new Error(
          "No fue posible crear el producto del restaurante"
        );
      }
    });

    // =====================================================
    // GRUK REALTIME
    // Solo después de COMMIT exitoso.
    // =====================================================

    const io = req.app.get("io");

    if (io) {
      io.emit("menu:actualizado", {
        restaurantId
      });
    }

    console.log(
      "GRUK CREATE confirmado:",
      {
        menuId: nuevoProducto.id,
        menuObjectId: nuevoProducto._id,
        productoServicioId:
          nuevoProducto.productoServicioId
      }
    );

    return res.status(201).json({
      ok: true,
      mensaje: "Producto guardado correctamente",
      producto: nuevoProducto
    });

  } catch (error) {
    console.error(
      "Error transaccional creando producto:",
      error
    );

    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      ok: false,
      error:
        error.message ||
        "Error interno guardando producto"
    });

  } finally {
    await session.endSession();
  }
});


router.put("/menu/:id", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    const {
      nombre,
      descripcion,
      precio,
      costoMateriaPrima,
      categoria,
      guarniciones,
      extras,
      imagen,
      tiempoBase,
      disponible
    } = req.body;

    // =====================================================
    // GRUK — VALIDACIÓN ESTRICTA DE ACTUALIZACIÓN
    // =====================================================

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Identificador de producto no válido"
      });
    }

    if (
      !nombre ||
      precio === undefined ||
      precio === null ||
      !categoria
    ) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const precioNumerico = Number(precio);
    const costoNumerico = Number(costoMateriaPrima || 0);
    const tiempoNumerico = Number(tiempoBase || 10);

    if (
      !Number.isFinite(precioNumerico) ||
      precioNumerico < 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "El precio del producto no es válido"
      });
    }

    if (
      !Number.isFinite(costoNumerico) ||
      costoNumerico < 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "El costo de materia prima no es válido"
      });
    }

    if (
      !Number.isFinite(tiempoNumerico) ||
      tiempoNumerico < 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "El tiempo base no es válido"
      });
    }

    const Menu = require("../models/menu");

    let productoActualizado = null;

    // =====================================================
    // GRUK — UNIDAD ATÓMICA DE ACTUALIZACIÓN
    // CORE + VERTICAL RESTAURANTE
    // =====================================================

    await session.withTransaction(async () => {

      // ===================================================
      // 1. RESOLVER EMPRESA PROPIETARIA
      // ===================================================

      const restaurante = await Restaurante.findOne({
        restaurantId
      })
        .select("_id restaurantId empresaId")
        .session(session);

      if (!restaurante) {
        const error = new Error(
          "Restaurante no encontrado"
        );

        error.statusCode = 404;
        throw error;
      }

      if (!restaurante.empresaId) {
        const error = new Error(
          "El restaurante todavía no está vinculado a una empresa"
        );

        error.statusCode = 409;
        throw error;
      }

      // ===================================================
      // 2. LOCALIZAR PRODUCTO DE LA VERTICAL
      // ===================================================

      const productoActual = await Menu.findOne({
        restaurantId,
        id
      }).session(session);

      if (!productoActual) {
        const error = new Error(
          "Producto no encontrado"
        );

        error.statusCode = 404;
        throw error;
      }

      let productoCore = null;

      // ===================================================
      // 3. RESOLVER IDENTIDAD ECONÓMICA CORE
      // ===================================================

      if (productoActual.productoServicioId) {

        productoCore =
          await ProductoServicio.findOne({
            _id: productoActual.productoServicioId,
            empresaId: restaurante.empresaId
          }).session(session);

        if (!productoCore) {
          const error = new Error(
            "La identidad CORE del producto no corresponde a esta empresa"
          );

          error.statusCode = 409;
          throw error;
        }

      } else {

        // ===============================================
        // MIGRACIÓN TRANSACCIONAL DE PRODUCTO LEGACY
        // ===============================================

        const productosCore =
          await ProductoServicio.create(
            [
              {
                empresaId: restaurante.empresaId,
                sedeId: null,

                tipo: "producto",

                nombre: String(nombre).trim(),

                descripcion:
                  String(descripcion || "").trim(),

                categoria:
                  String(categoria).trim(),

                precioVenta:
                  precioNumerico,

                costoUnitario:
                  costoNumerico,

                manejaInventario: false,
                unidad: "unidad",

                activo: true,
                origen: "restaurante",

                metadata: {
                  restaurantId,
                  menuId: id,
                  migradoDesdeMenuLegacy: true
                }
              }
            ],
            {
              session
            }
          );

        productoCore = productosCore[0];

        if (!productoCore) {
          throw new Error(
            "No fue posible crear la identidad CORE del producto legacy"
          );
        }
      }

      // ===================================================
      // 4. ACTUALIZAR IDENTIDAD ECONÓMICA CORE
      // ===================================================

      const coreActualizado =
        await ProductoServicio.findOneAndUpdate(
          {
            _id: productoCore._id,
            empresaId: restaurante.empresaId
          },
          {
            $set: {
              nombre:
                String(nombre).trim(),

              descripcion:
                String(descripcion || "").trim(),

              categoria:
                String(categoria).trim(),

              precioVenta:
                precioNumerico,

              costoUnitario:
                costoNumerico
            }
          },
          {
            new: true,
            runValidators: true,
            session
          }
        );

      if (!coreActualizado) {
        const error = new Error(
          "No fue posible sincronizar el producto con GRUK CORE"
        );

        error.statusCode = 409;
        throw error;
      }

      // ===================================================
      // 5. ACTUALIZAR REPRESENTACIÓN RESTAURANTE
      // ===================================================

      productoActualizado =
        await Menu.findOneAndUpdate(
          {
            _id: productoActual._id,
            restaurantId,
            id
          },
          {
            $set: {
              productoServicioId:
                productoCore._id,

              nombre:
                String(nombre).trim(),

              descripcion:
                String(descripcion || "").trim(),

              precio:
                precioNumerico,

              costoMateriaPrima:
                costoNumerico,

              categoria:
                String(categoria).trim(),

              guarniciones:
                Array.isArray(guarniciones)
                  ? guarniciones
                  : [],

              extras:
                Array.isArray(extras)
                  ? extras
                  : [],

              imagen:
                String(imagen || ""),

              tiempoBase:
                tiempoNumerico,

              disponible:
                disponible === true ||
                disponible === "true"
            }
          },
          {
            new: true,
            runValidators: true,
            session
          }
        );

      if (!productoActualizado) {
        const error = new Error(
          "No fue posible actualizar el producto del restaurante"
        );

        error.statusCode = 409;
        throw error;
      }
    });

    // =====================================================
    // GRUK REALTIME
    // Nunca emitir antes de que MongoDB confirme COMMIT.
    // =====================================================

    const io = req.app.get("io");

    if (io) {
      io.emit("menu:actualizado", {
        restaurantId
      });
    }

    console.log(
      "GRUK UPDATE confirmado:",
      {
        restaurantId,
        menuId: productoActualizado.id,
        menuObjectId: productoActualizado._id,
        productoServicioId:
          productoActualizado.productoServicioId
      }
    );

    return res.json({
      ok: true,
      mensaje: "Producto actualizado correctamente",
      producto: productoActualizado
    });

  } catch (error) {

    console.error(
      "Error transaccional actualizando producto:",
      error
    );

    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      ok: false,
      error:
        error.message ||
        "Error interno actualizando producto"
    });

  } finally {

    await session.endSession();
  }
});

router.put("/menu/:id/stock", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    // =====================================================
    // GRUK RESTAURANTES — DISPONIBILIDAD OPERACIONAL
    // =====================================================

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Identificador de producto no válido"
      });
    }

    if (
      req.body.disponible !== true &&
      req.body.disponible !== false &&
      req.body.disponible !== "true" &&
      req.body.disponible !== "false"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Estado de disponibilidad no válido"
      });
    }

    const disponible =
      req.body.disponible === true ||
      req.body.disponible === "true";

    const Menu = require("../models/menu");

    const producto = await Menu.findOneAndUpdate(
      {
        restaurantId,
        id
      },
      {
        $set: {
          disponible
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado"
      });
    }

    const io = req.app.get("io");

    if (io) {
      io.emit("menu:actualizado", {
        restaurantId
      });
    }

    return res.json({
      ok: true,
      producto
    });

  } catch (error) {
    console.error(
      "Error actualizando disponibilidad operacional:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Error actualizando disponibilidad del producto"
    });
  }
});

router.delete("/menu/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    // =====================================================
    // GRUK — VALIDACIÓN DE IDENTIDAD
    // =====================================================

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Identificador de producto no válido"
      });
    }

    const Menu = require("../models/menu");

    // =====================================================
    // GRUK RESTAURANTES — LOCALIZAR PRODUCTO
    // =====================================================

    const producto = await Menu.findOne({
      restaurantId,
      id
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado"
      });
    }

    // =====================================================
    // GRUK CORE — VERIFICAR PROPIEDAD EMPRESARIAL
    // =====================================================

    const restaurante = await Restaurante.findOne({
      restaurantId
    }).select("_id restaurantId empresaId");

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

    let productoCore = null;

    if (producto.productoServicioId) {
      productoCore = await ProductoServicio.findOne({
        _id: producto.productoServicioId,
        empresaId: restaurante.empresaId
      });

      if (!productoCore) {
        return res.status(409).json({
          ok: false,
          error:
            "La identidad CORE del producto no corresponde a esta empresa"
        });
      }
    }

    // =====================================================
    // GRUK CORE — RETIRO LÓGICO
    // =====================================================
    //
    // La identidad económica NO se elimina.
    // Debe permanecer disponible para:
    //
    // - ventas históricas
    // - costos históricos
    // - reportes
    // - auditoría
    // - GRUK Intelligence
    // - memoria empresarial
    //
    // =====================================================

    if (productoCore) {
      productoCore.activo = false;

      productoCore.metadata = {
        ...(productoCore.metadata || {}),
        retiradoDesde: "restaurante",
        restaurantId,
        menuId: id,
        fechaRetiro: new Date()
      };

      await productoCore.save();
    }

    // =====================================================
    // GRUK RESTAURANTES — RETIRAR DE LA VERTICAL
    // =====================================================

    try {
      await Menu.deleteOne({
        _id: producto._id,
        restaurantId
      });
    } catch (menuError) {

      // Compensación provisional:
      // si falla la eliminación del Menu después de retirar CORE,
      // restauramos el estado anterior del producto CORE.
      if (productoCore) {
        try {
          productoCore.activo = true;

          productoCore.metadata = {
            ...(productoCore.metadata || {})
          };

          delete productoCore.metadata.retiradoDesde;
          delete productoCore.metadata.fechaRetiro;

          productoCore.markModified("metadata");

          await productoCore.save();

        } catch (rollbackError) {
          console.error(
            "CRITICAL: fallo restaurando ProductoServicio después de DELETE:",
            rollbackError
          );
        }
      }

      throw menuError;
    }

    // =====================================================
    // GRUK REALTIME — NOTIFICAR A LA VERTICAL
    // =====================================================

    const io = req.app.get("io");

    if (io) {
      io.emit("menu:actualizado", {
        restaurantId
      });
    }

    return res.json({
      ok: true,
      mensaje: "Producto retirado correctamente",
      producto: {
        id: producto.id,
        productoServicioId:
          producto.productoServicioId || null
      }
    });

  } catch (error) {
    console.error(
      "Error retirando producto del menú:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Error interno retirando producto"
    });
  }
});
/* =========================
   PEDIDOS
========================= */



router.post("/pedido", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);

    const {
      mesa,
      sedeId,
      observaciones,
      metodoPago,
      cantidad,
      extra,
      menuItemId,
      productoServicioId
    } = req.body;

    // =====================================================
    // GRUK RESTAURANTES — VALIDACIÓN OPERACIONAL
    // =====================================================

    const mesaNumerica = Number(mesa);
    const cantidadNumerica = Number(cantidad || 1);

    if (
      !Number.isInteger(mesaNumerica) ||
      mesaNumerica <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Mesa no válida"
      });
    }

    if (
      !Number.isInteger(cantidadNumerica) ||
      cantidadNumerica <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Cantidad no válida"
      });
    }

    const metodosPagoPermitidos = [
      "efectivo",
      "transferencia",
      "pse",
      "tarjeta"
    ];

    const metodoPagoNormalizado =
      metodoPago || "efectivo";

    if (
      !metodosPagoPermitidos.includes(
        metodoPagoNormalizado
      )
    ) {
      return res.status(400).json({
        ok: false,
        error: "Método de pago no válido"
      });
    }

    // =====================================================
    // GRUK SECURITY — IDENTIDAD DEL PRODUCTO
    // El navegador identifica; el servidor verifica.
    // =====================================================

    if (
      !menuItemId ||
      !mongoose.Types.ObjectId.isValid(menuItemId)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Identidad de producto no válida"
      });
    }

    const Menu = require("../models/menu");

    const menuItem = await Menu.findOne({
      _id: menuItemId,
      restaurantId
    });

    if (!menuItem) {
      return res.status(404).json({
        ok: false,
        error:
          "El producto no pertenece a este restaurante"
      });
    }

    if (!menuItem.disponible) {
      return res.status(409).json({
        ok: false,
        error:
          "El producto no se encuentra disponible"
      });
    }

    if (!menuItem.productoServicioId) {
      return res.status(409).json({
        ok: false,
        error:
          "El producto todavía no tiene identidad GRUK CORE"
      });
    }

    // Si el cliente envía productoServicioId,
    // debe coincidir con la identidad registrada en Menu.
    if (
      productoServicioId &&
      (
        !mongoose.Types.ObjectId.isValid(
          productoServicioId
        ) ||
        String(productoServicioId) !==
          String(menuItem.productoServicioId)
      )
    ) {
      return res.status(409).json({
        ok: false,
        error:
          "La identidad económica enviada no corresponde al producto"
      });
    }

    // =====================================================
    // GRUK CORE — VERIFICAR PROPIEDAD EMPRESARIAL
    // =====================================================

    const restaurante = await Restaurante.findOne({
      restaurantId
    }).select(
      "_id restaurantId empresaId"
    );

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    if (!restaurante.empresaId) {
      return res.status(409).json({
        ok: false,
        error:
          "El restaurante todavía no está vinculado a una empresa"
      });
    }

    const productoCore =
      await ProductoServicio.findOne({
        _id: menuItem.productoServicioId,
        empresaId: restaurante.empresaId,
        tipo: "producto"
      });

    if (!productoCore) {
      return res.status(409).json({
        ok: false,
        error:
          "La identidad GRUK CORE no pertenece a esta empresa"
      });
    }

    if (!productoCore.activo) {
      return res.status(409).json({
        ok: false,
        error:
          "El producto se encuentra inactivo en GRUK CORE"
      });
    }

    // =====================================================
    // GRUK RESTAURANTES — VALIDAR EXTRA
    // Nunca confiar en valorExtra enviado por el navegador.
    // =====================================================

    let extraNombre = "";
    let valorExtraUnitario = 0;

    const extraSolicitado =
      typeof extra === "string"
        ? extra.trim()
        : "";

    if (
      extraSolicitado &&
      extraSolicitado !== "Sin extra"
    ) {
      const extraAutorizado =
        menuItem.extras.find(
          (item) =>
            String(item.nombre)
              .trim()
              .toLowerCase() ===
            extraSolicitado.toLowerCase()
        );

      if (!extraAutorizado) {
        return res.status(400).json({
          ok: false,
          error:
            "El extra seleccionado no pertenece a este producto"
        });
      }

      const precioExtra =
        Number(extraAutorizado.precio);

      if (
        !Number.isFinite(precioExtra) ||
        precioExtra < 0
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "El extra tiene una configuración económica inválida"
        });
      }

      extraNombre =
        String(extraAutorizado.nombre).trim();

      valorExtraUnitario = precioExtra;
    }

    // =====================================================
    // GRUK CORE — AUTORIDAD ECONÓMICA
    // El precio NO proviene del navegador.
    // =====================================================

    const precioBase =
      Number(menuItem.precio);

    if (
      !Number.isFinite(precioBase) ||
      precioBase < 0
    ) {
      return res.status(409).json({
        ok: false,
        error:
          "El producto tiene un precio inválido"
      });
    }

    const precioUnitario =
      precioBase + valorExtraUnitario;

    const precioTotal =
      precioUnitario * cantidadNumerica;

    if (
      !Number.isFinite(precioTotal) ||
      precioTotal < 0
    ) {
      return res.status(409).json({
        ok: false,
        error:
          "No fue posible calcular el valor del pedido"
      });
    }

    // =====================================================
    // GRUK — CREACIÓN TRAZABLE DEL PEDIDO
    // Vertical Restaurante ↔ Identidad económica CORE
    // =====================================================

    const pedido = new Pedido({
      restaurantId,

      sedeId:
        typeof sedeId === "string"
          ? sedeId.trim()
          : "",

      menuItemId: menuItem._id,

      productoServicioId:
        productoCore._id,

      mesa: mesaNumerica,

      producto:
        String(menuItem.nombre).trim(),

      categoria:
        String(menuItem.categoria || "").trim(),

      observaciones:
        typeof observaciones === "string"
          ? observaciones.trim()
          : "",

      cantidad:
        cantidadNumerica,

      precioUnitario,

      valorExtraUnitario,

      extra:
        extraNombre,

      precio:
        precioTotal,

      metodoPago:
        metodoPagoNormalizado,

      estado:
        "pendiente",

      estadoPago:
        "pendiente",

      tiempoEstimado:
        Number(menuItem.tiempoBase || 15)
    });

    await pedido.save();

    // =====================================================
    // GRUK REALTIME
    // Solo después de persistencia confirmada.
    // =====================================================

    const io = req.app.get("io");

    if (io) {
      io.emit(
        "pedido:nuevo",
        pedido
      );
    }

    console.log(
      "GRUK ORDER confirmado:",
      {
        pedidoId:
          pedido._id,

        restaurantId:
          pedido.restaurantId,

        menuItemId:
          pedido.menuItemId,

        productoServicioId:
          pedido.productoServicioId,

        cantidad:
          pedido.cantidad,

        precioUnitario:
          pedido.precioUnitario,

        total:
          pedido.precio
      }
    );

    return res.status(201).json({
      ok: true,
      pedido
    });

  } catch (error) {
    console.error(
      "Error creando pedido GRUK:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "No se pudo crear el pedido"
    });
  }
});
router.get("/pedidos", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const sedeId = req.query.sedeId || "";

    const filtro = { restaurantId };

    // 👇 SOLO si viene sedeId, filtra por sede
    if (sedeId) {
      filtro.sedeId = sedeId;
    }

    const pedidos = await Pedido.find(filtro).sort({ createdAt: -1 });

    res.json(pedidos);
  } catch (error) {
    res.status(500).json({
      mensaje: "Error obteniendo pedidos",
      error
    });
  }
});

router.get("/pedidos/mesa/:mesa", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);

    const pedidos = await Pedido.find({ restaurantId, mesa }).sort({ createdAt: -1 });

    const subtotal = pedidos
      .filter(p => p.estado !== "entregado")
      .reduce((acc, p) => acc + p.precio, 0);

    res.json({ pedidos, subtotal });
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo pedidos por mesa", error });
  }
});

router.put("/pedido/:id/estado", async (req, res) => {
  try {
    const { estado, tiempoEstimado } = req.body;

    const update = { estado };
    if (tiempoEstimado) {
      update.tiempoEstimado = Number(tiempoEstimado);
    }

    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    const io = req.app.get("io");
    io.emit("pedido:actualizado", pedido);

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ mensaje: "Error actualizando pedido", error });
  }
});

router.put("/pedido/:id/pago", async (req, res) => {
  try {
    const { estadoPago } = req.body;

    // 1. Buscar el pedido antes de modificarlo
    const pedidoAnterior = await Pedido.findById(req.params.id);

    if (!pedidoAnterior) {
      return res.status(404).json({
        ok: false,
        mensaje: "Pedido no encontrado"
      });
    }

    // 2. Actualizar el estado del pago
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { estadoPago },
      { new: true }
    );

    // 3. Registrar la venta empresarial solamente cuando pasa a pagado
    if (
      estadoPago === "pagado" &&
      pedidoAnterior.estadoPago !== "pagado"
    ) {
      const restaurante = await Restaurante.findOne({
        restaurantId: pedido.restaurantId
      });

      if (!restaurante) {
        throw new Error(
          `No se encontró el restaurante ${pedido.restaurantId}`
        );
      }

      if (!restaurante.empresaId) {
        throw new Error(
          "El restaurante todavía no está vinculado a una empresa"
        );
      }

      let sedeObjectId = null;

      if (pedido.sedeId) {
        const sede = await Sede.findOne({
          $or: [
            { codigoSede: pedido.sedeId },
            { _id: mongoose.Types.ObjectId.isValid(pedido.sedeId)
                ? pedido.sedeId
                : null }
          ]
        });

        if (sede) {
          sedeObjectId = sede._id;
        }
      }

      const resultadoVenta = await registrarVentaDesdePedido({
        pedido,
        empresaId: restaurante.empresaId,
        sedeId: sedeObjectId
      });

      if (resultadoVenta.creada) {
        console.log(
          `Venta empresarial registrada desde pedido ${pedido._id}`
        );
      } else {
        console.log(
          `Venta del pedido ${pedido._id} ya estaba registrada`
        );
      }
    }

    // 4. Mantener Socket.IO funcionando como antes
    const io = req.app.get("io");
    io.emit("pedido:actualizado", pedido);

    res.json({
      ok: true,
      pedido
    });

  } catch (error) {
    console.error("Error actualizando pago:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error actualizando pago",
      error: error.message
    });
  }
});

/* =========================
   LLAMADOS / MESERO
========================= */

router.post("/llamar-mesero", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { mesa, mensaje, meseroId } = req.body;

    if (!meseroId) {
      return res.status(400).json({
        ok: false,
        error: "Debes seleccionar un mesero"
      });
    }

    const Personal = require("../models/personal");

    const mesero = await Personal.findById(meseroId);

    if (!mesero) {
      return res.status(404).json({
        ok: false,
        error: "Mesero no encontrado"
      });
    }

    if (mesero.estado === "ocupado") {
      return res.status(400).json({
        ok: false,
        error: "Ese mesero ya está ocupado"
      });
    }

    const llamadaActiva = await Llamado.findOne({
      restaurantId,
      mesa: Number(mesa),
      estado: { $in: ["pendiente", "atendiendo"] }
    }).sort({ createdAt: -1 });

    if (llamadaActiva) {
      return res.json({
        ok: true,
        mensaje: "Ya existe una solicitud activa para esta mesa",
        llamado: llamadaActiva
      });
    }

    const llamado = new Llamado({
      restaurantId,
      mesa: Number(mesa),
      mensaje: mensaje || "Mesa necesita atención",
      estado: "pendiente",
      meseroId: mesero._id.toString(),
      meseroNombre: mesero.nombre
    });

    await llamado.save();

    mesero.estado = "ocupado";
    await mesero.save();

    const io = req.app.get("io");
    io.emit("llamado:nuevo", llamado);

    res.json({
      ok: true,
      llamado
    });
  } catch (error) {
    console.log("Error creando llamado:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error creando llamado",
      error
    });
  }
});

router.get("/llamados", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const llamados = await Llamado.find({ restaurantId }).sort({ createdAt: -1 });
    res.json(llamados);
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo llamados", error });
  }
});

router.get("/llamados/mesa/:mesa", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);

    const llamado = await Llamado.findOne({
      restaurantId,
      mesa
    }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      llamado: llamado || null
    });
  } catch (error) {
    console.log("Error obteniendo llamado por mesa:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno obteniendo llamado"
    });
  }
});

router.put("/llamados/:id/atendiendo", async (req, res) => {
  try {
    const llamado = await Llamado.findByIdAndUpdate(
      req.params.id,
      { estado: "atendiendo" },
      { new: true }
    );

    if (!llamado) {
      return res.status(404).json({
        ok: false,
        error: "Llamado no encontrado"
      });
    }

    const io = req.app.get("io");
    io.emit("llamado:actualizado", llamado);

    res.json({
      ok: true,
      llamado
    });
  } catch (error) {
    console.log("Error marcando atendiendo:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno actualizando llamado"
    });
  }
});

router.put("/llamados/mesa/:mesa/atendido", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);

    const llamado = await Llamado.findOneAndUpdate(
      {
        restaurantId,
        mesa,
        estado: { $in: ["pendiente", "atendiendo"] }
      },
      {
        estado: "atendido"
      },
      {
        new: true,
        sort: { createdAt: -1 }
      }
    );

    if (!llamado) {
      return res.status(404).json({
        ok: false,
        error: "No hay llamado activo para esa mesa"
      });
    }

    if (llamado.meseroId) {
      const Personal = require("../models/personal");
      await Personal.findByIdAndUpdate(llamado.meseroId, {
        estado: "disponible"
      });
    }

    const io = req.app.get("io");
    io.emit("llamado:actualizado", llamado);

    res.json({
      ok: true,
      mensaje: "Llamado marcado como atendido",
      llamado
    });
  } catch (error) {
    console.log("Error marcando llamado atendido:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno marcando llamado"
    });
  }
});

router.get("/mesero/mesas", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);

    const llamados = await Llamado.find({
      restaurantId,
      estado: { $in: ["pendiente", "atendiendo"] }
    }).sort({ createdAt: -1 });

    const mesasMap = {};

    llamados.forEach(llamado => {
      if (!mesasMap[llamado.mesa]) {
        mesasMap[llamado.mesa] = {
          _id: llamado._id,
          mesa: llamado.mesa,
          estado: llamado.estado,
          mensaje: llamado.mensaje || "Mesa necesita atención",
          meseroId: llamado.meseroId || "",
          meseroNombre: llamado.meseroNombre || ""
        };
      }
    });

    res.json(Object.values(mesasMap));
  } catch (error) {
    console.log("Error obteniendo mesas mesero:", error);
    res.status(500).json([]);
  }
});

/* =========================
   ADMIN
========================= */

router.get("/admin/resumen", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);

    const pedidos = await Pedido.find({ restaurantId }).sort({ createdAt: -1 });
    const activos = pedidos.filter(p => p.estado !== "entregado");
    const totalVendido = pedidos.reduce((acc, p) => acc + p.precio, 0);

    const topMap = {};
    pedidos.forEach(p => {
      if (!topMap[p.producto]) topMap[p.producto] = 0;
      topMap[p.producto] += 1;
    });

    const topProductos = Object.entries(topMap)
      .map(([producto, cantidad]) => ({ producto, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const historial = pedidos.slice(0, 20);

    res.json({
      totalVendido,
      pedidosActivos: activos.length,
      topProductos,
      historial
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error resumen admin", error });
  }
});

router.post("/admin/registro", async (req, res) => {
  try {
    const { restaurantId, usuario, password } = req.body;

    if (!restaurantId || !usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const Admin = require("../models/admin");
    

    const existeRestaurant = await Admin.findOne({ restaurantId });
    if (existeRestaurant) {
      return res.status(400).json({
        ok: false,
        error: "Ese restaurantId ya tiene administrador"
      });
    }

    const existeUsuario = await Admin.findOne({ usuario });
    if (existeUsuario) {
      return res.status(400).json({
        ok: false,
        error: "Ese usuario ya existe"
      });
    }

    const nuevoAdmin = new Admin({
      restaurantId,
      usuario,
      password
    });

    await nuevoAdmin.save();

    res.json({
      ok: true,
      mensaje: "Administrador creado correctamente"
    });
  } catch (error) {
    console.log("Error registrando admin:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno registrando administrador"
    });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const usuario = String(req.body?.usuario || "").trim();
    const password = String(req.body?.password || "");

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan usuario o contraseña"
      });
    }

    const Admin = require("../models/admin");

    let admin = await Admin.findOne({ usuario });

    let restaurante = null;
    let autenticado = false;
    let usuarioFinal = usuario;
    let restaurantId = null;

    if (admin) {
      const passwordGuardado = String(admin.password || "");

      if (passwordGuardado.startsWith("$2")) {
        autenticado = await bcrypt.compare(
          password,
          passwordGuardado
        );
      } else {
        autenticado = password === passwordGuardado;

        if (autenticado) {
          admin.password = await bcrypt.hash(password, 12);
          await admin.save();

          console.log(
            `[SEGURIDAD] Admin migrado a bcrypt: ${admin._id}`
          );
        }
      }

      if (autenticado) {
        restaurantId = admin.restaurantId;
      }
    }

    if (!autenticado) {
      restaurante = await Restaurante.findOne({
        usuarioAdmin: usuario
      });

      if (restaurante) {
        const passwordGuardado =
          String(restaurante.passwordAdmin || "");

        if (passwordGuardado.startsWith("$2")) {
          autenticado = await bcrypt.compare(
            password,
            passwordGuardado
          );
        } else {
          autenticado = password === passwordGuardado;

          if (autenticado) {
            restaurante.passwordAdmin =
              await bcrypt.hash(password, 12);

            await restaurante.save();

            console.log(
              `[SEGURIDAD] Restaurante migrado a bcrypt: ${restaurante._id}`
            );
          }
        }

        if (autenticado) {
          restaurantId = restaurante.restaurantId;
          usuarioFinal = restaurante.usuarioAdmin;
        }
      }
    }

    if (!autenticado) {
      return res.status(401).json({
        ok: false,
        error: "Usuario o contraseña incorrectos"
      });
    }

    return res.json({
      ok: true,
      restaurantId,
      usuario: usuarioFinal
    });

  } catch (error) {
    console.error("Error login admin:", error);

    return res.status(500).json({
      ok: false,
      error: "Error interno en login"
    });
  }
});
/* =========================
   FACTURA / QR
========================= */

router.get("/factura/mesa/:mesa", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);
    const propina = Number(req.query.propina || 0);

    const pedidos = await Pedido.find({ restaurantId, mesa }).sort({ createdAt: -1 });

    const subtotal = pedidos
      .filter(p => p.estado !== "entregado")
      .reduce((acc, p) => acc + p.precio, 0);

    const valorPropina = Math.round(subtotal * (propina / 100));
    const total = subtotal + valorPropina;

    res.json({
      mesa,
      pedidos,
      subtotal,
      propina,
      valorPropina,
      total
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error generando factura", error });
  }
});

router.get("/qr/:mesa", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);
    const baseUrl = req.query.baseUrl || `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/?restaurantId=${restaurantId}&mesa=${mesa}`;

    const dataUrl = await QRCode.toDataURL(url);

    res.json({
      mesa,
      restaurantId,
      url,
      dataUrl
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error generando QR", error });
  }
});
router.get("/qr-sede/:mesa", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const mesa = Number(req.params.mesa);
    const sedeId = req.query.sedeId || "";

    const baseUrl = req.query.baseUrl || `${req.protocol}://${req.get("host")}`;

    const url = `${baseUrl}/?restaurantId=${restaurantId}&sedeId=${sedeId}&mesa=${mesa}`;

    const dataUrl = await QRCode.toDataURL(url);

    res.json({
      ok: true,
      mesa,
      restaurantId,
      sedeId,
      url,
      dataUrl
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      error: "Error generando QR por sede"
    });
  }
});

/* =========================
   PERSONAL
========================= */

router.post("/personal", async (req, res) => {
  try {

    const {
      restaurantId,
      nombre,
      cargo,
      salario,
      estado,
      usuario,
      password
    } = req.body;

    if (!restaurantId || !nombre || !cargo || !usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const Personal = require("../models/personal");

    const existeUsuario = await Personal.findOne({
      restaurantId,
      usuario
    });

    if (existeUsuario) {
      return res.status(400).json({
        ok: false,
        error: "Ese usuario ya existe en este restaurante"
      });
    }

    const nuevoPersonal = new Personal({
      restaurantId,
      nombre,
      cargo,
      salario: Number(salario || 0),
      estado: estado || "disponible",
      usuario,
      password
    });

    await nuevoPersonal.save();

    res.json({
      ok: true,
      mensaje: "Personal agregado correctamente",
      personal: nuevoPersonal
    });

  } catch (error) {

    console.log(
      "Error guardando personal:",
      error
    );

    res.status(500).json({
      ok: false,
      error: "Error interno guardando personal"
    });

  }
});

router.get("/personal", async (req, res) => {
  try {

    const restaurantId = getRestaurantId(req);

    const Personal =
      require("../models/personal");

    const personal =
      await Personal.find({
        restaurantId
      }).sort({
        createdAt: -1
      });

    res.json(personal);

  } catch (error) {

    console.log(
      "Error obteniendo personal:",
      error
    );

    res.status(500).json([]);

  }
});

router.get("/personal/meseros", async (req, res) => {
  try {

    const restaurantId =
      getRestaurantId(req);

    const Personal =
      require("../models/personal");

    const meseros =
      await Personal.find({
        restaurantId,
        cargo: {
          $in: [
            "mesero",
            "mesera"
          ]
        }
      }).sort({
        createdAt: -1
      });

    res.json(meseros);

  } catch (error) {

    console.log(
      "Error obteniendo meseros:",
      error
    );

    res.status(500).json([]);

  }
});

router.put("/personal/:id/estado", async (req, res) => {
  try {

    const { estado } = req.body;

    const Personal =
      require("../models/personal");

    const persona =
      await Personal.findByIdAndUpdate(
        req.params.id,
        { estado },
        { new: true }
      );

    if (!persona) {
      return res.status(404).json({
        ok: false,
        error: "Persona no encontrada"
      });
    }

    res.json({
      ok: true,
      persona
    });

  } catch (error) {

    console.log(
      "Error cambiando estado:",
      error
    );

    res.status(500).json({
      ok: false,
      error: "Error interno"
    });

  }
});

router.delete("/personal/:id", async (req, res) => {
  try {

    const Personal =
      require("../models/personal");

    const personaEliminada =
      await Personal.findByIdAndDelete(
        req.params.id
      );

    if (!personaEliminada) {
      return res.status(404).json({
        ok: false,
        error: "Persona no encontrada"
      });
    }

    res.json({
      ok: true,
      mensaje: "Personal eliminado correctamente"
    });

  } catch (error) {

    console.log(
      "Error eliminando personal:",
      error
    );

    res.status(500).json({
      ok: false,
      error: "Error interno eliminando personal"
    });

  }
});

router.post("/mesero/login", async (req, res) => {
  try {

    const {
      usuario,
      password
    } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan usuario o contraseña"
      });
    }

    const Personal =
      require("../models/personal");

    const mesero =
      await Personal.findOne({
        usuario,
        password,
        cargo: {
          $in: [
            "mesero",
            "mesera"
          ]
        }
      });

    if (!mesero) {
      return res.status(401).json({
        ok: false,
        error: "Usuario o contraseña incorrectos"
      });
    }

    res.json({
      ok: true,
      mesero: {
        _id: mesero._id,
        nombre: mesero.nombre,
        usuario: mesero.usuario,
        cargo: mesero.cargo,
        salario: mesero.salario || 0,
        restaurantId: mesero.restaurantId
      }
    });

  } catch (error) {

    console.log(
      "Error login mesero:",
      error
    );

    res.status(500).json({
      ok: false,
      error: "Error interno en login de mesero"
    });

  }
});
router.post("/restaurante/registro", async (req, res) => {
  try {
    const {
      restaurantId,
      nombreRestaurante,
      correo,
      usuarioAdmin,
      passwordAdmin,
      aceptaPlan
    } = req.body;

    if (!restaurantId || !nombreRestaurante || !correo || !usuarioAdmin || !passwordAdmin) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    if (!aceptaPlan) {
      return res.status(400).json({
        ok: false,
        error: "Debes aceptar el plan mensual"
      });
    }

    
    const Admin = require("../models/admin");

    const existeRestaurantId = await Restaurante.findOne({ restaurantId });
    if (existeRestaurantId) {
      return res.status(400).json({
        ok: false,
        error: "Ese Restaurant ID ya existe"
      });
    }

    const existeCorreo = await Restaurante.findOne({ correo });
    if (existeCorreo) {
      return res.status(400).json({
        ok: false,
        error: "Ese correo ya está registrado"
      });
    }

    const existeUsuarioAdmin = await Restaurante.findOne({ usuarioAdmin });
    if (existeUsuarioAdmin) {
      return res.status(400).json({
        ok: false,
        error: "Ese usuario admin ya existe"
      });
    }

    const nuevoRestaurante = new Restaurante({
      restaurantId,
      nombreRestaurante,
      correo,
      usuarioAdmin,
      passwordAdmin,
      plan: "mensual",
      precioMensual: 220000,
      estadoSuscripcion: "pendiente",
      aceptaPlan: false
    });

    await nuevoRestaurante.save();
    console.log("GUARDADO REAL:",
      nuevoRestaurante);
  

await Sede.create({
  restauranteId: nuevoRestaurante.restaurantId,
  nombreSede: "Principal",
  codigoSede: `${nuevoRestaurante.restaurantId}_principal`,
  direccion: ""
});


    const nuevoAdmin = new Admin({
      restaurantId,
      usuario: usuarioAdmin,
      password: passwordAdmin
    });

    await nuevoAdmin.save();

    res.json({
      ok: true,
      mensaje: "Restaurante registrado correctamente",
      restaurante: nuevoRestaurante
    });
  } catch (error) {
    console.log("Error registrando restaurante:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno registrando restaurante"
    });
  }
});

/* =========================
   SUSCRIPCION / PRIMER PAGO
========================= */

// Devuelve lo necesario para abrir el widget / checkout del primer pago
router.post("/crear-pago-suscripcion", async (req, res) => {
  try {
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        ok: false,
        error: "Falta restaurantId"
      });
    }

    const restaurante = await Restaurante.findOne({ restaurantId });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    const amountInCents = 220000 * 100;
    const currency = "COP";
    const reference = `suscripcion_${restaurantId}_${Date.now()}`;

    const acceptanceRes = await axios.get(
      `https://production.wompi.co/v1/merchants/${process.env.WOMPI_PUBLIC_KEY}`
    );

    const acceptanceToken =
      acceptanceRes.data.data.presigned_acceptance.acceptance_token;

    const signatureRaw = `${reference}${amountInCents}${currency}${process.env.WOMPI_INTEGRITY_KEY}`;
    const signature = crypto
      .createHash("sha256")
      .update(signatureRaw)
      .digest("hex");

    res.json({
      ok: true,
      pago: {
        amountInCents,
        currency,
        reference,
        acceptanceToken,
        signature,
        publicKey: process.env.WOMPI_PUBLIC_KEY,
        customerEmail: restaurante.correo,
        customerData: {
          fullName: restaurante.nombreRestaurante,
          phoneNumber: "",
          legalId: ""
        }
      }
    });
  } catch (error) {
    console.log("Error creando pago de suscripción:", error?.response?.data || error);
    res.status(500).json({
      ok: false,
      error: "Error interno creando pago de suscripción"
    });
  }
});

// Consulta estado de suscripción
router.get("/restaurante/estado-suscripcion", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);

    const restaurante = await Restaurante.findOne({ restaurantId });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }


    res.json({
      ok: true,
      estadoSuscripcion: restaurante.estadoSuscripcion,
      plan: restaurante.plan,
      precioMensual: restaurante.precioMensual,
      fechaUltimoPago: restaurante.fechaUltimoPago,
      fechaProximoCobro: restaurante.fechaProximoCobro
    });
  } catch (error) {
    console.log("Error consultando suscripción:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno consultando suscripción"
    });
  }
});

// Webhook de Wompi
router.post("/wompi/webhook", async (req, res) => {
  try {
    const evento = req.body;
    const transaction = evento?.data?.transaction;

    if (!transaction) {
      return res.status(200).json({ ok: true });
    }

    const reference = transaction.reference || "";
    const status = transaction.status;
    const transactionId = transaction.id;

    if (
  !reference.startsWith("suscripcion_") &&
  !reference.startsWith("renovacion_")
) {
  return res.status(200).json({ ok: true });
}

   const partes = reference.split("_");
let restaurantId = "";

if (reference.startsWith("suscripcion_")) {
  restaurantId = partes[1] + "_" + partes[2];
}

if (reference.startsWith("renovacion_")) {
  restaurantId = partes[1] + "_" + partes[2];
}
    const restaurante = await Restaurante.findOne({ restaurantId });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    if (status === "APPROVED") {
      const hoy = new Date();
      const proximo = new Date(hoy);
      proximo.setDate(proximo.getDate() + 30);

      restaurante.estadoSuscripcion = "activa";
      restaurante.fechaUltimoPago = hoy;
      restaurante.fechaProximoCobro = proximo;
      restaurante.ultimoTransactionId = transactionId;

      await restaurante.save();
    }

    if (status === "DECLINED" || status === "ERROR" || status === "VOIDED") {
  restaurante.estadoSuscripcion = "pendiente";
  restaurante.ultimoTransactionId = transactionId;
  await restaurante.save();
}
    

    res.status(200).json({ ok: true });
  } catch (error) {
    console.log("Error webhook Wompi:", error);
    res.status(500).json({ ok: false });
  }
});

router.post("/registro-y-fuente-pago", async (req, res) => {
  try {
    const {
      nombre,
      correo,
      usuario,
      password,
      acceptanceToken,
      paymentMethodToken,
      customerEmail
    } = req.body;

    const wompiPublicKey = process.env.WOMPI_PUBLIC_KEY;
    const wompiPrivateKey = process.env.WOMPI_PRIVATE_KEY;

    if (!nombre || !correo || !usuario || !password) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    if (!paymentMethodToken || !customerEmail || !acceptanceToken) {
      return res.status(400).json({ ok: false, error: "Faltan datos del pago" });
    }

    if (!wompiPublicKey || !wompiPrivateKey) {
      return res.status(500).json({
        ok: false,
        error: "Faltan llaves de Wompi en Render"
      });
    }

    const existeUsuario = await Usuario.findOne({ usuario });
    if (existeUsuario) {
      return res.status(400).json({ ok: false, error: "Ese usuario admin ya existe" });
    }

    const paymentSourceRes = await axios.post(
      "https://production.wompi.co/v1/payment_sources",
      {
        type: "CARD",
        token: paymentMethodToken,
        customer_email: customerEmail,
        acceptance_token: acceptanceToken
      },
      {
        headers: {
          Authorization: `Bearer ${wompiPrivateKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paymentSource = paymentSourceRes.data?.data;

    if (!paymentSource || paymentSource.status !== "AVAILABLE") {
      return res.status(400).json({
        ok: false,
        error: "No se pudo crear la fuente de pago"
      });
    }

    const restaurantId = `rest_${Date.now()}`;
    const nuevaEmpresa = await Empresa.create({
  empresaId: `emp_${Date.now()}`,
  nombre,
  tipoNegocio: "restaurante",
  correo,
  estado: "activa",

  modulos: {
    restaurante: true,
    inventario: true,
    finanzas: true,
    facturacion: true,
    laboral: true,
    inteligencia: false
  }
});

    const nuevoRestaurante = await Restaurante.create({
      restaurantId,
      nombreRestaurante: nombre,
      correo,
      usuarioAdmin: usuario,
      passwordAdmin: password,
      wompiPublicKey,
      wompiPrivateKey,
      paymentSourceId: String(paymentSource.id),
      customerEmailWompi: customerEmail,
      tokenizacionCompleta: true,
      plan: "mensual",
      precioMensual: 220000,
      estadoSuscripcion: "pendiente",
      fechaUltimoPago: null,
      fechaProximoCobro: null,
      ultimoTransactionId: "",
      aceptaPlan: true
    });

    const sedePrincipal = await Sede.create({
  empresaId: nuevaEmpresa._id,
  restauranteId: restaurantId,
  nombreSede: "Principal",
  codigoSede: `${restaurantId}_principal`,
  direccion: ""
});

    await Usuario.create({
  empresaId: nuevaEmpresa._id,
  restauranteId: restaurantId,
  sedeId: sedePrincipal._id,
  nombre,
  usuario,
  password,
  rol: "admin_general",
  estado: "activo"
});

    return res.json({
      ok: true,
      restauranteId: nuevoRestaurante.restaurantId,
      paymentSourceId: paymentSource.id
    });
  } catch (error) {
    console.log("Error registro y fuente pago:", error?.response?.data || error?.message || error);

    return res.status(500).json({
      ok: false,
      error:
        error?.response?.data?.error?.reason ||
        error?.response?.data?.error?.message ||
        error?.message ||
        "Error creando fuente de pago"
    });
  }
});

router.post("/sede/crear", async (req, res) => {
  try {
    const { restauranteId, nombreSede, direccion } = req.body;

    if (!restauranteId || !nombreSede) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    // Buscar el restaurante para obtener su empresa
    const restaurante = await Restaurante.findOne({
      restaurantId: restauranteId
    });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    const codigoSede = `${restauranteId}_${Date.now()}`;

    const nueva = new Sede({
      empresaId: restaurante.empresaId || null,
      restauranteId,
      nombreSede,
      codigoSede,
      direccion
    });

    await nueva.save();

    res.json({
      ok: true,
      sede: nueva
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      ok: false,
      error: "Error creando sede"
    });
  }
});
router.post("/usuarios/crear", async (req, res) => {
  try {
    const {
      restauranteId,
      sedeId,
      nombre,
      usuario,
      password,
      rol
    } = req.body;

    if (!restauranteId || !nombre || !usuario || !password || !rol) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    // Buscar restaurante para obtener empresaId
    const restaurante = await Restaurante.findOne({
      restaurantId: restauranteId
    });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    const existe = await Usuario.findOne({ usuario });

    if (existe) {
      return res.status(400).json({
        ok: false,
        error: "Ese usuario ya existe"
      });
    }

    const nuevoUsuario = new Usuario({
      empresaId: restaurante.empresaId || null,
      restauranteId,
      sedeId: sedeId || null,
      nombre,
      usuario,
      password,
      rol
    });

    await nuevoUsuario.save();

    res.json({
      ok: true,
      usuario: nuevoUsuario
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      ok: false,
      error: "Error creando usuario"
    });
  }
});
router.post("/usuarios/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;

   

    const user = await Usuario.findOne({
      usuario,
      password,
      estado: "activo"
    }).populate("sedeId");

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Usuario o contraseña incorrectos"
      });
    }

    res.json({
      ok: true,
      usuario: {
        id: user._id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
        restauranteId: user.restauranteId,
        sedeId: user.sedeId ? user.sedeId._id : null,
        nombreSede: user.sedeId ? user.sedeId.nombreSede : null
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      error: "Error en login"
    });
  }
});
router.get("/debug/limpiar-registro", async (req, res) => {
  try {
    const usuario = (req.query.usuario || "").trim();

   
    
   

    if (!usuario) {
      return res.status(400).json({
        ok: false,
        error: "Falta usuario"
      });
    }

    const usuarios = await Usuario.find({
      $or: [{ usuario }, { nombre: usuario }]
    });

    const restauranteIds = usuarios
      .map(u => u.restauranteId)
      .filter(Boolean);

    await Usuario.deleteMany({
      $or: [{ usuario }, { nombre: usuario }]
    });

    if (restauranteIds.length) {
      await Sede.deleteMany({ restauranteId: { $in: restauranteIds } });
      await Restaurante.deleteMany({ restaurantId: { $in: restauranteIds } });
    }

    res.json({
      ok: true,
      mensaje: "Registro limpiado",
      restauranteIds
    });
  } catch (error) {
    console.log("Error limpiando registro:", error);
    res.status(500).json({
      ok: false,
      error: "Error limpiando registro"
    });
  }
});
router.get("/wompi/webhook", (req, res) => {
  res.json({
    ok: true,
    mensaje: "Webhook Wompi disponible"
  });
});

router.post("/suscripciones/cobrar", async (req, res) => {
  try {
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({
        ok: false,
        error: "Falta restaurantId"
      });
    }

    const restaurante = await Restaurante.findOne({ restaurantId });

    if (!restaurante) {
      return res.status(404).json({
        ok: false,
        error: "Restaurante no encontrado"
      });
    }

    if (!restaurante.paymentSourceId) {
      return res.status(400).json({
        ok: false,
        error: "No hay fuente de pago guardada"
      });
    }

    if (!restaurante.customerEmailWompi) {
      return res.status(400).json({
        ok: false,
        error: "Falta customerEmailWompi"
      });
    }


    const wompiPublicKey =
      restaurante.wompiPublicKey || process.env.WOMPI_PUBLIC_KEY;

    const WOMPI_PRIVATE_KEY =
      restaurante.WOMPI_PRIVATE_KEY || process.env.WOMPI_PRIVATE_KEY;

    if (!wompiPublicKey || !WOMPI_PRIVATE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Faltan llaves de Wompi"
      });
    }

    const amountInCents = restaurante.precioMensual * 100;
    const currency = "COP";
    const reference = `renovacion_${restaurantId}_${Date.now()}`;
    

    const merchantRes = await axios.get(
      `https://production.wompi.co/v1/merchants/${wompiPublicKey}`
    );

    const acceptanceToken =
      merchantRes?.data?.data?.presigned_acceptance?.acceptance_token;

    if (!acceptanceToken) {
      return res.status(500).json({
        ok: false,
        error: "No se pudo obtener acceptance token"
      });
    }

    const txRes = await axios.post(
      "https://production.wompi.co/v1/transactions",
      {
        acceptance_token: acceptanceToken,
        amount_in_cents: amountInCents,
        currency,
        customer_email: restaurante.customerEmailWompi,
        reference,
        payment_source_id: Number(restaurante.paymentSourceId)
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (txRes.data.data.status === "APPROVED") {
  restaurante.estadoSuscripcion = "activa";
  restaurante.fechaUltimoPago = new Date();
  restaurante.fechaProximoCobro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  restaurante.ultimoTransactionId = txRes.data.data.id;

  await restaurante.save();
}

    return res.json({
      ok: true,
      mensaje: "Cobro enviado a Wompi",
      data: txRes.data
    });
  } catch (error) {
    console.log(
      "Error cobrando suscripción:",
      error?.response?.data || error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.response?.data?.error?.reason ||
        "Error cobrando suscripción"
    });
  }
});

router.post("/confirmar-pago", async (req, res) => {
try {
const { transactionId, restaurantId } = req.body;

console.log("Confirmando pago:", { transactionId, restaurantId });

if (!transactionId || !restaurantId) {
return res.status(400).json({
ok: false,
error: "Faltan datos para confirmar el pago"
});
}

const wompiRes = await axios.get(
`https://production.wompi.co/v1/transactions/${transactionId}`
);

const transaction = wompiRes.data.data;
console.log("Respuesta Wompi:", transaction);

if (!transaction) {
return res.status(404).json({
ok: false,
error: "Transacción no encontrada"
});
}

if (transaction.status !== "APPROVED") {
return res.status(400).json({
ok: false,
error: `Pago no aprobado. Estado: ${transaction.status}`
});
}

const restaurante = await Restaurante.findOne({ restaurantId });

if (!restaurante) {
return res.status(404).json({
ok: false,
error: "Restaurante no encontrado"
});
}

if (restaurante.ultimoTransactionId === String(transactionId)) {
return res.json({
ok: true,
mensaje: "Pago ya confirmado anteriormente"
});
}

restaurante.estadoSuscripcion = "activa";
restaurante.aceptaPlan = true;
restaurante.ultimoTransactionId = String(transactionId);
restaurante.fechaUltimoPago = new Date();
restaurante.fechaProximoCobro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

await restaurante.save();

return res.json({
ok: true,
mensaje: "Pago confirmado correctamente"
});
} catch (error) {
console.log("ERROR REAL confirmar-pago:", error.response?.data || error.message);

return res.status(500).json({
ok: false,
error: "Error confirmando pago"
});
}
});

module.exports = router;