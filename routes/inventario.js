const express = require("express");
const Joi = require("joi");
const mongoose = require("mongoose");

const router = express.Router();

const Inventario =
require("../models/Inventario");
const Restaurante = require("../models/restaurante");
const Sede = require("../models/sede");
const ProductoServicio = require("../models/ProductoServicio");
const authMiddleware = require("../core/auth/auth.middleware");
const {
  ROLES_GRUK,
  roleCheck
} = require("../core/auth/roleCheck.middleware");
const inventarioQuerySchema = Joi.object({
  q: Joi.string().trim().max(100).allow("").default(""),
  categoria: Joi.string().trim().max(80).allow("").default(""),
  estado: Joi.string().valid("", "vigente", "proximo", "vencido", "agotado").default(""),
  stock: Joi.string().valid("", "agotado", "bajo", "disponible").default(""),
  proveedor: Joi.string().trim().max(100).allow("").default(""),
  orden: Joi.string().valid("vencimiento", "nombre", "cantidad_asc", "cantidad_desc", "valor_desc").default("vencimiento"),
  page: Joi.number().integer().min(1).max(100000).optional(),
  limit: Joi.number().integer().min(1).max(200).optional()
}).required().unknown(false);

function escaparRegex(valor) {
  return String(valor || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function calcularEstadoInventario(producto, hoy) {
  const cantidad = Number(producto.cantidad || 0);
  if (cantidad <= 0) return { estado: "agotado", diasRestantes: producto.fechaVencimiento ? 0 : null };
  if (!producto.fechaVencimiento) return { estado: producto.estado || "vigente", diasRestantes: null };
  const vencimiento = new Date(producto.fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
  if (diasRestantes <= 0) return { estado: "vencido", diasRestantes };
  if (diasRestantes <= 5) return { estado: "proximo", diasRestantes };
  return { estado: "vigente", diasRestantes };
}

function ordenarInventario(productos, orden) {
  return [...productos].sort((a, b) => {
    if (orden === "nombre") return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
    if (orden === "cantidad_asc") return Number(a.cantidad || 0) - Number(b.cantidad || 0);
    if (orden === "cantidad_desc") return Number(b.cantidad || 0) - Number(a.cantidad || 0);
    if (orden === "valor_desc") return (Number(b.cantidad || 0) * Number(b.costo || 0)) - (Number(a.cantidad || 0) * Number(a.costo || 0));
    const diasA = a.diasRestantes == null ? Number.MAX_SAFE_INTEGER : Number(a.diasRestantes);
    const diasB = b.diasRestantes == null ? Number.MAX_SAFE_INTEGER : Number(b.diasRestantes);
    if (diasA !== diasB) return diasA - diasB;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" });
  });
}

router.post(
  "/",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
  try {
    const datos = { ...req.body };
    // Reject orphan inventory and caller-controlled audit/lifecycle state.
    // The model allows legacy null restaurantId, but new writes must not.
    if (typeof datos.restaurantId !== "string" ||
        !datos.restaurantId.trim() || datos.restaurantId.length > 128) {
      return res.status(400).json({ ok: false, error: "Restaurante requerido" });
    }
    for (const forbidden of ["_id", "anulado", "motivoAnulacion",
      "usuarioAnulacion", "fechaAnulacion", "createdAt", "updatedAt"]) {
      if (Object.prototype.hasOwnProperty.call(datos, forbidden)) {
        return res.status(400).json({ ok: false, error: "Campos protegidos de inventario" });
      }
    }

    // The signed tenant must own the restaurant, regardless of client empresaId.
    if (datos.empresaId && String(datos.empresaId) !== String(req.auth.empresaId)) {
      return res.status(403).json({ ok: false, error: "Inventario fuera de empresa" });
    }
    const restaurante = await Restaurante.findOne({
      restaurantId: datos.restaurantId,
      empresaId: req.auth.empresaId
    }).select("_id").lean();
    if (!restaurante) {
      return res.status(403).json({ ok: false, error: "Restaurante fuera de empresa" });
    }
    datos.empresaId = req.auth.empresaId;

    // A branch administrator cannot create inventory at a sibling site, nor
    // create site-less inventory to make it visible company-wide.
    if (req.auth.rol !== ROLES_GRUK.DUENO) {
      if (!mongoose.Types.ObjectId.isValid(req.auth.sedeId)) {
        return res.status(403).json({ ok: false, error: "Sede autorizada requerida" });
      }
      if (datos.sedeId != null && String(datos.sedeId) !== String(req.auth.sedeId)) {
        return res.status(403).json({ ok: false, error: "Inventario fuera de sede" });
      }
      datos.sedeId = req.auth.sedeId;
    }

    // Even the owner cannot attach a foreign company's or another
    // restaurant's branch to newly created inventory.
    if (datos.sedeId != null) {
      if (!mongoose.Types.ObjectId.isValid(datos.sedeId)) {
        return res.status(400).json({ ok: false, error: "Sede inválida" });
      }
      const sede = await Sede.findOne({
        _id: datos.sedeId,
        empresaId: req.auth.empresaId,
        restauranteId: datos.restaurantId
      }).select("_id").lean();
      if (!sede) {
        return res.status(403).json({ ok: false, error: "Sede fuera de empresa o restaurante" });
      }
    }

    // A supplied catalog ID is untrusted. It must belong to the signed
    // enterprise, with a global scope or the exact inventory branch.
    if (datos.productoServicioId != null) {
      if (!mongoose.Types.ObjectId.isValid(datos.productoServicioId)) {
        return res.status(400).json({ ok: false, error: "Producto de catálogo inválido" });
      }
      const producto = await ProductoServicio.findOne({
        _id: datos.productoServicioId,
        empresaId: req.auth.empresaId,
        sedeId: datos.sedeId == null ? null : { $in: [datos.sedeId, null] }
      }).select("_id").lean();
      if (!producto) {
        return res.status(403).json({
          ok: false, error: "Producto de catálogo fuera de empresa o sede"
        });
      }
    }

    const inventario = new Inventario(datos);

    await inventario.save();

    res.json({
      ok: true,
      inventario
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      ok: false,
      error: "Error guardando inventario"
    });
  }
});

router.get(
  "/:restaurantId",
  authMiddleware,
  roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
  async (req, res) => {
    try {
      const { error, value: filtros } = inventarioQuerySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: false,
        convert: true
      });

      if (error) {
        return res.status(400).json({
          ok: false,
          error: error.details.map((item) => item.message).join("; ")
        });
      }

      const restaurante = await Restaurante.findOne({
        restaurantId: req.params.restaurantId,
        empresaId: req.auth.empresaId
      });

      if (!restaurante) {
        return res.status(403).json({
          ok: false,
          error: "No tienes acceso al inventario de este restaurante"
        });
      }

      const query = {
        empresaId: req.auth.empresaId,
        restaurantId: req.params.restaurantId,
        anulado: false
      };

      if (req.auth.rol !== ROLES_GRUK.DUENO) {
        if (!mongoose.Types.ObjectId.isValid(req.auth.sedeId)) {
          return res.status(403).json({ ok: false, error: "Sede autorizada requerida" });
        }
        query.sedeId = req.auth.sedeId;
      }

      if (filtros.q) {
        const patron = new RegExp(escaparRegex(filtros.q), "i");
        query.$or = [
          { nombre: patron },
          { categoria: patron },
          { proveedor: patron },
          { unidad: patron }
        ];
      }

      if (filtros.categoria) {
        query.categoria = new RegExp("^" + escaparRegex(filtros.categoria) + "$", "i");
      }

      if (filtros.proveedor) {
        query.proveedor = new RegExp(escaparRegex(filtros.proveedor), "i");
      }

      if (filtros.stock === "agotado") query.cantidad = { $lte: 0 };
      if (filtros.stock === "bajo") query.cantidad = { $gt: 0, $lte: 5 };
      if (filtros.stock === "disponible") query.cantidad = { $gt: 5 };

      const productos = await Inventario.find(query)
        .select("nombre categoria cantidad costo unidad proveedor fechaCompra fechaVencimiento estado prioridad sedeId restaurantId createdAt")
        .lean();

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      let procesados = productos.map((producto) => ({
        ...producto,
        ...calcularEstadoInventario(producto, hoy)
      }));

      if (filtros.estado) {
        procesados = procesados.filter((producto) => producto.estado === filtros.estado);
      }

      const ordenados = ordenarInventario(procesados, filtros.orden);

      const resumen = ordenados.reduce((acc, producto) => {
        acc.totalProductos += 1;
        if (producto.estado === "proximo") acc.proximos += 1;
        if (producto.estado === "vencido") acc.vencidos += 1;
        if (producto.estado === "agotado") acc.agotados += 1;
        if (Number(producto.cantidad || 0) > 0 && Number(producto.cantidad || 0) <= 5) acc.stockBajo += 1;
        acc.valorInventario += Number(producto.cantidad || 0) * Number(producto.costo || 0);
        return acc;
      }, { totalProductos: 0, proximos: 0, vencidos: 0, agotados: 0, stockBajo: 0, valorInventario: 0 });

      const total = ordenados.length;
      const usaPaginacion = Boolean(filtros.page && filtros.limit);
      const page = usaPaginacion ? filtros.page : 1;
      const limit = usaPaginacion ? filtros.limit : Math.max(total, 1);
      const inicio = usaPaginacion ? (page - 1) * limit : 0;
      const paginados = usaPaginacion
        ? ordenados.slice(inicio, inicio + limit)
        : ordenados;

      return res.json({
        ok: true,
        productos: paginados,
        resumen,
        paginacion: {
          page,
          limit,
          total,
          totalPaginas: usaPaginacion
            ? Math.max(1, Math.ceil(total / limit))
            : 1
        },
        filtrosAplicados: filtros
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        ok: false,
        error: "Error obteniendo inventario"
      });
    }
  }
);
router.put(
"/anular/:id",
authMiddleware,
roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE),
async (req,res)=>{

try{

const { motivo } = req.body;

// Never trust a caller-supplied audit identity; actor is the verified JWT.
const actorId = req.auth?.usuarioId;
if (!mongoose.Types.ObjectId.isValid(actorId)) {
  return res.status(403).json({ ok: false, error: "Actor autenticado requerido" });
}

if (req.auth.rol !== ROLES_GRUK.DUENO && !mongoose.Types.ObjectId.isValid(req.auth.sedeId)) {
  return res.status(403).json({ ok: false, error: "Sede autorizada requerida" });
}

if(!motivo){
return res.status(400).json({
ok:false,
error:"Debes escribir un motivo de anulación"
});
}

const producto =
await Inventario.findOneAndUpdate(
{
_id:req.params.id,
empresaId:req.auth.empresaId,
anulado:false,
...(req.auth.rol !== ROLES_GRUK.DUENO
  ? { sedeId: req.auth.sedeId }
  : {})
},
{
anulado:true,
motivoAnulacion:motivo,
usuarioAnulacion:String(actorId),
fechaAnulacion:new Date()
},
{ new:true }
);

if(!producto){
return res.status(404).json({
ok:false,
error:"Producto no encontrado"
});
}

res.json({
ok:true,
producto
});

}catch(error){

console.log(error);

res.status(500).json({
ok:false,
error:"Error anulando producto"
});

}

});

module.exports = router;