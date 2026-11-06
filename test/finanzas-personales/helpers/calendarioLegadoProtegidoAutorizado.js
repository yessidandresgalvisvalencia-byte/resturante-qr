"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Cal=require("../../../modules/finanzas-personales/models/calendarioFinanciero.model"),C=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model"),Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal"),O=require("../../../modules/finanzas-personales/models/outboxPersonal.model"),E=require("../../../modules/finanzas-personales/models/eventoCalendarioIngresoPersonal.model");
const H=require("../../../modules/finanzas-personales/services/homePersonal.service"),S=require("../../../modules/finanzas-personales/services/calendarioIngresoPersonal.service");
async function probarCalendarioLegadoProtegido(){
 const u=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId(),ahora=new Date(),p=H._fechas.partesColombia(new Date(+ahora+3*86400000)),ancla=new Date(+ahora-60000);
 const c=await C.create({usuarioId:u,nombre:"LEGADO_PROTEGIDO",tipo:"EFECTIVO",saldoMinor:1000,saldoAnclaMinor:1000,saldoAnclaEn:ancla,saldoVerificadoEn:ancla,origenSaldo:"USUARIO",requiereReconciliacion:false});
 const original=await Cal.create({usuarioId:u,tipo:"INGRESO",concepto:"Fuente anterior conservada",montoMinor:500,diaMes:p.d,activo:true,origen:"USUARIO"});
 await Cal.create({usuarioId:otro,tipo:"INGRESO",concepto:"Ajeno",montoMinor:90000,diaMes:p.d});
 const foto=async()=>({original:await Cal.findById(original._id).lean(),cuenta:await C.findById(c._id).lean(),tx:await Tx.find({usuarioId:u}).lean(),outbox:await O.find({usuarioId:u}).lean(),eventos:await E.find({usuarioId:u}).lean()}),antes=await foto(),bson=mongoose.mongo.BSON.serialize(antes.original),home=await H.obtener(u,ahora),col=Cal.collection;
 assert.equal(home.asesor.proximoIngreso.montoMinor,500);
 const filtro={_id:original._id},cambio={$set:{activo:false,montoMinor:999}};
 for(const op of [()=>col.updateOne(filtro,cambio),()=>col.updateMany({},cambio),()=>col.replaceOne(filtro,{...antes.original,montoMinor:1}),()=>col.findOneAndUpdate(filtro,cambio),()=>col.deleteOne(filtro),()=>col.deleteMany({usuarioId:u}),()=>col.findOneAndDelete(filtro),()=>col.bulkWrite([{updateOne:{filter:filtro,update:cambio}}])])await assert.rejects(op(),e=>e.code===13);
 const carreras=await Promise.allSettled(Array.from({length:12},()=>col.updateOne(filtro,cambio)));
 assert.ok(carreras.every(r=>r.status==="rejected"&&r.reason.code===13));
 const sesion=await mongoose.startSession();try{await assert.rejects(sesion.withTransaction(async()=>{await C.updateOne({_id:c._id},{$inc:{saldoMinor:50}},{session:sesion});await col.updateOne(filtro,cambio,{session:sesion});}),e=>e.code===13);}finally{await sesion.endSession();}
 assert.deepEqual(await foto(),antes,"rechazos y rollback conservan caja, fuentes e historial");assert.deepEqual(mongoose.mongo.BSON.serialize((await foto()).original),bson);assert.deepEqual(await H.obtener(u,ahora),home);
 const propios=await S.consultar(u),ajenos=await S.consultar(otro);assert.equal(propios.legados.length,1);assert.equal(propios.legados[0]._id,String(original._id));assert.equal(propios.legados[0].gestion,"LEGADO_NO_ADOPTADO");assert.equal(ajenos.legados.some(x=>x._id===String(original._id)),false);
 assert.deepEqual(await foto(),antes,"consultar no adopta ni altera fuentes");
}
module.exports={probarCalendarioLegadoProtegido};
