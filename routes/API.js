const express = require("express");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

const Pedido = require("../models/pedido.js");
const Llamado = require("../models/llamado");
const Restaurante = require("../models/restaurante");
const Usuario = require("../models/usuario");
const Sede = require("../models/sede");
const Empresa = require("../models/Empresa");
const Venta = require("../models/Venta");
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

if (!restaurantId || !nombre || !precio || !categoria) {
return res.status(400).json({
ok: false,
error: "Faltan datos obligatorios"
});
}
// =====================================================
// GRUK CORE — RESOLUCIÓN SEGURA DE IDENTIDAD EMPRESARIAL
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

// Validación económica.
// No confiamos únicamente en Number() porque NaN también es Number.
const precioNumerico = Number(precio);
const costoNumerico = Number(costoMateriaPrima || 0);

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

const Menu = require("../models/menu");

const ultimoProducto = await Menu.findOne({ restaurantId }).sort({ id: -1 });
const nuevoId = ultimoProducto ? ultimoProducto.id + 1 : 1;
// =====================================================
// GRUK CORE — IDENTIDAD ECONÓMICA DEL PRODUCTO
// =====================================================

let productoCore = null;

try {
  productoCore = await ProductoServicio.create({
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
  });
} catch (coreError) {
  console.error(
    "Error creando ProductoServicio CORE:",
    coreError
  );

  return res.status(500).json({
    ok: false,
    error: "No se pudo crear la identidad empresarial del producto"
  });
}
const nuevoProducto = new Menu({
restaurantId,
id: nuevoId,
productoServicioId: productoCore._id,
nombre,
descripcion: descripcion || "",

precio: precioNumerico,

costoMateriaPrima: costoNumerico,

categoria,
guarniciones: Array.isArray(guarniciones) ? guarniciones : [],
extras: Array.isArray(extras) ? extras : [],
imagen,
tiempoBase: Number(tiempoBase || 10),
disponible: disponible === true || disponible === "true"
});

try {
  await nuevoProducto.save();
} catch (menuError) {

  // Compensación:
  // si Restaurante falla después de crear CORE,
  // eliminamos la identidad económica huérfana.
  if (productoCore?._id) {
    try {
      await ProductoServicio.deleteOne({
        _id: productoCore._id,
        empresaId: restaurante.empresaId
      });
    } catch (rollbackError) {
      console.error(
        "CRITICAL: no se pudo revertir ProductoServicio huérfano:",
        rollbackError
      );
    }
  }

  throw menuError;
}

const io = req.app.get("io");
if (io) {
io.emit("menu:actualizado", { restaurantId });
}

console.log("producto guardado:", nuevoProducto);

return res.json({
ok: true,
mensaje: "Producto guardado correctamente",
producto: nuevoProducto
});
} catch (error) {
console.log("ERROR REAL guardando producto:", error);
return res.status(500).json({
ok: false,
error: error.message || "Error interno guardando producto"
});
}
});

router.put("/menu/:id", async (req, res) => {
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
// GRUK — VALIDACIÓN DE ACTUALIZACIÓN DE PRODUCTO
// =====================================================

if (!Number.isInteger(id) || id <= 0) {
  return res.status(400).json({
    ok: false,
    error: "Identificador de producto no válido"
  });
}

if (!nombre || precio === undefined || precio === null || !categoria) {
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
// =====================================================
// GRUK CORE — VERIFICACIÓN DE IDENTIDAD Y PROPIEDAD
// =====================================================

const productoActual = await Menu.findOne({
  restaurantId,
  id
});

if (!productoActual) {
  return res.status(404).json({
    ok: false,
    error: "Producto no encontrado"
  });
}

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
// =====================================================
// GRUK CORE — RESOLVER O CREAR IDENTIDAD ECONÓMICA
// =====================================================

let productoCore = null;

if (productoActual.productoServicioId) {

  productoCore = await ProductoServicio.findOne({
    _id: productoActual.productoServicioId,
    empresaId: restaurante.empresaId
  });

  if (!productoCore) {
    return res.status(409).json({
      ok: false,
      error: "La identidad CORE del producto no corresponde a esta empresa"
    });
  }

} else {

  productoCore = await ProductoServicio.create({
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
      menuId: id,
      migradoDesdeMenuLegacy: true
    }
  });

  productoActual.productoServicioId = productoCore._id;

  await productoActual.save();
}
// =====================================================
// GRUK CORE — SINCRONIZACIÓN ECONÓMICA
// =====================================================

const coreActualizado = await ProductoServicio.findOneAndUpdate(
  {
    _id: productoCore._id,
    empresaId: restaurante.empresaId
  },
  {
    $set: {
      nombre: String(nombre).trim(),
      descripcion: String(descripcion || "").trim(),
      categoria: String(categoria).trim(),

      precioVenta: precioNumerico,
      costoUnitario: costoNumerico,

      activo: disponible === true || disponible === "true"
    }
  },
  {
    new: true,
    runValidators: true
  }
);

if (!coreActualizado) {
  return res.status(409).json({
    ok: false,
    error: "No fue posible sincronizar el producto con GRUK CORE"
  });
}
const productoActualizado = await Menu.findOneAndUpdate(
{ restaurantId, id },
{
$set: {
  productoServicioId: productoCore._id,
nombre,
descripcion: descripcion || "",
precio: precioNumerico,

costoMateriaPrima: costoNumerico,

categoria,

guarniciones: Array.isArray(guarniciones)
? guarniciones
: [],

extras: Array.isArray(extras)
? extras
: [],

imagen,

tiempoBase: tiempoNumerico,

disponible:
disponible === true ||
disponible === "true"
}
},
{ new: true }
);

if (!productoActualizado) {
return res.status(404).json({
ok: false,
error: "Producto no encontrado"
});
}

const io = req.app.get("io");
if (io) {
io.emit("menu:actualizado", { restaurantId });
}

return res.json({
ok: true,
mensaje: "Producto actualizado correctamente",
producto: productoActualizado
});
} catch (error) {
console.log("ERROR REAL actualizando producto:", error);
return res.status(500).json({
ok: false,
error: error.message || "Error interno actualizando producto"
});
}
});

router.put("/menu/:id/stock", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    // =====================================================
    // GRUK — VALIDACIÓN DE DISPONIBILIDAD
    // =====================================================

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Identificador de producto no válido"
      });
    }

    const disponible =
      req.body.disponible === true ||
      req.body.disponible === "true";

    const Menu = require("../models/menu");

    // =====================================================
    // GRUK RESTAURANTES — RESOLVER PRODUCTO
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
    // GRUK CORE — RESOLVER PROPIEDAD EMPRESARIAL
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

    // =====================================================
    // GRUK CORE — SINCRONIZAR ESTADO ECONÓMICO
    // =====================================================

    if (producto.productoServicioId) {
      const coreActualizado =
        await ProductoServicio.findOneAndUpdate(
          {
            _id: producto.productoServicioId,
            empresaId: restaurante.empresaId
          },
          {
            $set: {
              activo: disponible
            }
          },
          {
            new: true,
            runValidators: true
          }
        );

      if (!coreActualizado) {
        return res.status(409).json({
          ok: false,
          error:
            "La identidad CORE del producto no corresponde a esta empresa"
        });
      }
    }

    // =====================================================
    // GRUK RESTAURANTES — ACTUALIZAR DISPONIBILIDAD
    // =====================================================

    producto.disponible = disponible;

    await producto.save();

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
      "Error actualizando disponibilidad del producto:",
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

const Menu = require("../models/menu");

const productoEliminado = await Menu.findOneAndDelete({
restaurantId,
id
});

if (!productoEliminado) {
return res.status(404).json({
ok: false,
error: "Producto no encontrado"
});
}

const io = req.app.get("io");
if (io) {
io.emit("menu:actualizado", { restaurantId });
}

return res.json({
ok: true,
mensaje: "Producto eliminado correctamente"
});
} catch (error) {
console.log("Error eliminando producto:", error);
return res.status(500).json({
ok: false,
error: "Error interno eliminando producto"
});
}
});
/* =========================
   PEDIDOS
========================= */



router.post("/pedido", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const { mesa, producto, categoria, precio, metodoPago, tiempoEstimado, sedeId, observaciones } = req.body;

    if (!mesa || !producto || !precio) {
      return res.status(400).json({ mensaje: "Faltan datos del pedido" });
    }

    const pedido = new Pedido({
      restaurantId,
      sedeId: sedeId || "",
      mesa: Number(mesa),
      producto,
      observaciones: observaciones || "",
      categoria: categoria || "",
      precio: Number(precio),
      metodoPago: metodoPago || "efectivo",
      estado: "pendiente",
      estadoPago: "pendiente",
      tiempoEstimado: Number(tiempoEstimado || 15)
    });

    await pedido.save();

    const io = req.app.get("io");
    io.emit("pedido:nuevo", pedido);

    return res.json(pedido);
  } catch (error) {
    console.log("ERROR REAL /pedido:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "No se pudo enviar el pedido"
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

      try {
        await Venta.create({
          empresaId: restaurante.empresaId,
          sedeId: sedeObjectId,

          origen: "restaurante",
          origenId: pedido._id,

          concepto: pedido.producto,
          categoria: pedido.categoria || "",

          cantidad: 1,
          precioUnitario: pedido.precio,
          total: pedido.precio,

          metodoPago: pedido.metodoPago || "",

          estado: "pagada",

          metadata: {
            restaurantId: pedido.restaurantId,
            pedidoId: pedido._id.toString(),
            mesa: pedido.mesa
          }
        });

        console.log(
          `Venta empresarial registrada desde pedido ${pedido._id}`
        );

      } catch (ventaError) {

        // Código 11000 = MongoDB detectó una venta duplicada.
        // No dañamos el pago por un segundo intento.
        if (ventaError.code === 11000) {
          console.log(
            `Venta del pedido ${pedido._id} ya estaba registrada`
          );
        } else {
          throw ventaError;
        }
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
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan usuario o contraseña"
      });
    }

    const Admin = require("../models/admin");
    const Restaurante = require("../models/restaurante");

    let admin = await Admin.findOne({
      usuario,
      password
    });

    let usuarioFinal = usuario;

    if (!admin) {

      admin = await Restaurante.findOne({
        usuarioAdmin: usuario,
        passwordAdmin: password
      });

      if (admin) {
        usuarioFinal = admin.usuarioAdmin;
      }
    }

    if (!admin) {
      return res.status(401).json({
        ok: false,
        error: "Usuario o contraseña incorrectos"
      });
    }

    res.json({
      ok: true,
      restaurantId: admin.restaurantId,
      usuario: usuarioFinal
    });

  } catch (error) {
    console.log("Error login admin:", error);

    res.status(500).json({
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