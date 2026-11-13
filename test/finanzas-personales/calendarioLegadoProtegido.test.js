"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose");
const Cal=require("../../modules/finanzas-personales/models/calendarioFinanciero.model");
const datos=()=>({usuarioId:new mongoose.Types.ObjectId(),tipo:"INGRESO",concepto:"Original",montoMinor:500,diaMes:10});
test("calendario legado permite validar fuentes nuevas sin reescribir originales",async()=>{
 const original=new Cal(datos());await original.validate();assert.equal(original.isNew,true);
 original.isNew=false;original.montoMinor=600;
 await assert.rejects(original.save(),/CALENDARIO_LEGADO_APPEND_ONLY/);
 await assert.rejects(original.deleteOne(),/CALENDARIO_LEGADO_APPEND_ONLY/);
});
test("todas las vías de mutación del modelo rechazan incluso filtros vacíos",async()=>{
 const u={usuarioId:new mongoose.Types.ObjectId()};
 for(const op of [()=>Cal.updateOne(u,{$set:{activo:false}}),()=>Cal.updateMany({},{$set:{montoMinor:1}}),()=>Cal.replaceOne(u,datos()),()=>Cal.findOneAndUpdate(u,{$set:{diaMes:20}}),()=>Cal.findOneAndReplace(u,datos()),()=>Cal.findByIdAndUpdate(new mongoose.Types.ObjectId(),{$set:{activo:false}}),()=>Cal.deleteOne(u),()=>Cal.deleteMany({}),()=>Cal.findOneAndDelete(u),()=>Cal.findByIdAndDelete(new mongoose.Types.ObjectId()),()=>Cal.bulkWrite([{updateOne:{filter:u,update:{$set:{activo:false}}}}])])
  await assert.rejects(op(),e=>e.message==="CALENDARIO_LEGADO_APPEND_ONLY"&&e.statusCode===409);
});
