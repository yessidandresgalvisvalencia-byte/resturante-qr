const express = require("express");

const router = express.Router();

const Inventario =
require("../models/Inventario");

router.post("/", async (req,res)=>{

try{

const inventario =
new Inventario(req.body);

await inventario.save();

res.json({
ok:true,
inventario
});

}catch(error){

console.log(error);

res.status(500).json({
ok:false,
error:"Error guardando inventario"
});

}

});

router.get("/:restaurantId", async (req,res)=>{

try{

const productos =
await Inventario.find({
restaurantId:req.params.restaurantId
});

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

const productosProcesados =
productos.map(producto=>{

const vencimiento =
new Date(producto.fechaVencimiento);
vencimiento.setHours(0, 0, 0, 0);

const diferencia =
vencimiento - hoy;

const diasRestantes =
Math.ceil(
diferencia /
(1000 * 60 * 60 * 24)
);

let estado = "vigente";

if(diasRestantes <= 0){
estado = "vencido";
}
else if(diasRestantes <= 5){
estado = "proximo";
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

module.exports = router;