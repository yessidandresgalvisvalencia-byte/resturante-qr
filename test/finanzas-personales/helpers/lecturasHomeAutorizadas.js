"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const home=require("../../../modules/finanzas-personales/services/homePersonal.service");
async function probarLecturasHomeAutorizadas(){
 const usuarioId=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId();
 const base={usuarioId,tipo:"GASTO",concepto:"Recurrencia de prueba",categoria:"OTROS",
  recurrente:true,frecuencia:"MENSUAL",impactoCaja:false,fecha:new Date("2026-09-30T16:00:00.000Z"),montoMinor:1};
 // El compromiso grande es más antiguo que otros cien: limit(100) lo ocultaba.
 await Tx.insertMany([...Array.from({length:100},()=>({...base})),
  {...base,fecha:new Date("2026-08-30T16:00:00.000Z"),montoMinor:100000},
  {...base,usuarioId:otro,montoMinor:900000}]);
 const antes=await Tx.find({usuarioId}).sort({_id:1}).lean();
 const panel=await home.obtener(usuarioId,new Date("2026-10-29T15:00:00.000Z"));
 assert.equal(panel.asesor.gastosFijosAntesProximoIngresoMinor,100100);
 assert.equal(panel.asesor.compromisosAntesProximoIngreso.length,101);
 assert.equal(panel.asesor.aptoParaDisponibleHoy,false);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),antes);
}
module.exports={probarLecturasHomeAutorizadas};
