const express = require("express");

const router = express.Router();

const Inventario =
require("../models/Inventario");
const Restaurante = require("../models/restaurante");
router.post("/", async (req, res) => {
  try {
    const datos = { ...req.body };

    // Compatibilidad con GRUK Restaurantes:
    // si llega restaurantId, resolvemos automáticamente empresaId.
    if (datos.restaurantId && !datos.empresaId) {

      const restaurante = await Restaurante.findOne({
        restaurantId: datos.restaurantId
      });

      if (!restaurante) {
        return res.status(404).json({
          ok: false,
          error: "Restaurante no encontrado"
        });
      }

      datos.empresaId = restaurante.empresaId || null;
    }

    // Todo inventario nuevo debe pertenecer a una empresa.
    if (!datos.empresaId) {
      return res.status(400).json({
        ok: false,
        error: "No se pudo determinar la empresa del inventario"
      });
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

router.get("/:restaurantId", async (req,res)=>{

try{

const productos =
await Inventario.find({
restaurantId:req.params.restaurantId,
anulado:false
});

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

const productosProcesados =
productos.map(producto=>{

let diasRestantes = null;
let estado = producto.estado || "vigente";

if (producto.fechaVencimiento) {

  const vencimiento = new Date(producto.fechaVencimiento);

  vencimiento.setHours(0, 0, 0, 0);

  const diferencia = vencimiento - hoy;

  diasRestantes = Math.ceil(
    diferencia / (1000 * 60 * 60 * 24)
  );

  if (diasRestantes <= 0) {
    estado = "vencido";
  }
  else if (diasRestantes <= 5) {
    estado = "proximo";
  }
  else {
    estado = "vigente";
  }
}

return{
...producto._doc,
diasRestantes,
estado
};

});

res.json({
ok:true,
productos:productosProcesados
});

}catch(error){

console.log(error);

res.status(500).json({
ok:false,
error:"Error obteniendo inventario"
});

}

});
router.put("/anular/:id", async (req,res)=>{

try{

const { motivo, usuario } = req.body;

if(!motivo){
return res.status(400).json({
ok:false,
error:"Debes escribir un motivo de anulación"
});
}

const producto =
await Inventario.findByIdAndUpdate(
req.params.id,
{
anulado:true,
motivoAnulacion:motivo,
usuarioAnulacion:usuario || "admin",
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