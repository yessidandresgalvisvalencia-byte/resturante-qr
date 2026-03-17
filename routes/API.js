const express = require("express");
const QRCode = require("qrcode");
const router = express.Router();

const Pedido = require("../models/pedido.js");
const Llamado = require("../models/llamado");

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
      precio,
      categoria,
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

    const Menu = require("../models/menu");

    const ultimoProducto = await Menu.findOne({ restaurantId }).sort({ id: -1 });
    const nuevoId = ultimoProducto ? ultimoProducto.id + 1 : 1;

    const nuevoProducto = new Menu({
      restaurantId,
      id: nuevoId,
      nombre,
      precio,
      categoria,
      imagen: imagen || "",
      tiempoBase: tiempoBase || 10,
      disponible: disponible !== false
    });

    await nuevoProducto.save();

    const io = req.app.get("io");
    io.emit("menu:actualizado", { restaurantId });

    res.json({
      ok: true,
      mensaje: "Producto guardado correctamente",
      producto: nuevoProducto
    });
  } catch (error) {
    console.log("Error guardando producto:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno guardando producto"
    });
  }
});

router.put("/menu/:id", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    const {
      nombre,
      precio,
      categoria,
      imagen,
      tiempoBase,
      disponible
    } = req.body;

    const Menu = require("../models/menu");

    const productoActualizado = await Menu.findOneAndUpdate(
      { restaurantId, id },
      {
        nombre,
        precio,
        categoria,
        imagen,
        tiempoBase,
        disponible
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
    io.emit("menu:actualizado", { restaurantId });

    res.json({
      ok: true,
      mensaje: "Producto actualizado correctamente",
      producto: productoActualizado
    });
  } catch (error) {
    console.log("Error actualizando producto:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno actualizando producto"
    });
  }
});

router.put("/menu/:id/stock", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const id = Number(req.params.id);

    const Menu = require("../models/menu");

    const producto = await Menu.findOneAndUpdate(
      { restaurantId, id },
      { disponible: Boolean(req.body.disponible) },
      { new: true }
    );

    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const io = req.app.get("io");
    io.emit("menu:actualizado", { restaurantId });

    res.json(producto);
  } catch (error) {
    console.log("Error actualizando stock:", error);
    res.status(500).json({ mensaje: "Error actualizando stock" });
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
    io.emit("menu:actualizado", { restaurantId });

    res.json({
      ok: true,
      mensaje: "Producto eliminado correctamente"
    });
  } catch (error) {
    console.log("Error eliminando producto:", error);
    res.status(500).json({
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
    const { mesa, producto, categoria, precio, metodoPago, tiempoEstimado } = req.body;

    if (!mesa || !producto || !precio) {
      return res.status(400).json({ mensaje: "Faltan datos del pedido" });
    }

    const pedido = new Pedido({
      restaurantId,
      mesa: Number(mesa),
      producto,
      categoria: categoria || "",
      precio: Number(precio),
      metodoPago: metodoPago || "efectivo",
      estado: "pedido",
      estadoPago: "pendiente",
      tiempoEstimado: Number(tiempoEstimado || 15)
    });

    await pedido.save();

    const io = req.app.get("io");
    io.emit("pedido:nuevo", pedido);

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ mensaje: "Error creando pedido", error });
  }
});

router.get("/pedidos", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const pedidos = await Pedido.find({ restaurantId }).sort({ createdAt: -1 });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo pedidos", error });
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

    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { estadoPago },
      { new: true }
    );

    const io = req.app.get("io");
    io.emit("pedido:actualizado", pedido);

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ mensaje: "Error actualizando pago", error });
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

    const admin = await Admin.findOne({ usuario, password });

    if (!admin) {
      return res.status(401).json({
        ok: false,
        error: "Usuario o contraseña incorrectos"
      });
    }

    res.json({
      ok: true,
      restaurantId: admin.restaurantId,
      usuario: admin.usuario
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

/* =========================
   PERSONAL
========================= */

router.post("/personal", async (req, res) => {
  try {
    const { restaurantId, nombre, cargo, estado, usuario, password } = req.body;

    if (!restaurantId || !nombre || !cargo || !usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios"
      });
    }

    const Personal = require("../models/personal");

    const existeUsuario = await Personal.findOne({ restaurantId, usuario });
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
    console.log("Error guardando personal:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno guardando personal"
    });
  }
});

router.get("/personal", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const Personal = require("../models/personal");

    const personal = await Personal.find({ restaurantId }).sort({ createdAt: -1 });

    res.json(personal);
  } catch (error) {
    console.log("Error obteniendo personal:", error);
    res.status(500).json([]);
  }
});

router.get("/personal/meseros", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const Personal = require("../models/personal");

    const meseros = await Personal.find({
      restaurantId,
      cargo: { $in: ["mesero", "mesera"] }
    }).sort({ createdAt: -1 });

    res.json(meseros);
  } catch (error) {
    console.log("Error obteniendo meseros:", error);
    res.status(500).json([]);
  }
});

router.put("/personal/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;
    const Personal = require("../models/personal");

    const personaEliminada = await Personal.findByIdAndDelete(req.params.id);

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
    console.log("Error eliminando personal:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno eliminando personal"
    });
  }
});
router.post("/mesero/login", async (req, res) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan usuario o contraseña"
      });
    }

    const Personal = require("../models/personal");

    const mesero = await Personal.findOne({
      usuario,
      password,
      cargo: { $in: ["mesero", "mesera"] }
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
        restaurantId: mesero.restaurantId
      }
    });
  } catch (error) {
    console.log("Error login mesero:", error);
    res.status(500).json({
      ok: false,
      error: "Error interno en login de mesero"
    });
  }
});

module.exports = router;