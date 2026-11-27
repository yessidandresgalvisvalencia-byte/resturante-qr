"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Accion=require("../../../modules/finanzas-personales/models/accionProgresoPersonal.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {actualizarAccion}=require("../../../modules/finanzas-personales/services/actualizarAccionProgresoPersonal.service");
const {registrarTransaccion}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const aplicar=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service").crearAplicador();
async function probarEvidenciaProgresoAutorizada(){
 const usuarioId=new mongoose.Types.ObjectId(),fecha=new Date(Date.now()-60000);
 const accion=palanca=>Accion.create({usuarioId,clave:new mongoose.Types.ObjectId().toString(),palanca,
  titulo:"Acción de prueba",objetivoMinor:100,baselineMinor:2000,estado:"APROBADA"});
 const datos={cuenta:"EFECTIVO",fecha,concepto:"Evidencia de prueba",categoria:"OTROS"};
 const ingreso=await registrarTransaccion(usuarioId,{...datos,tipo:"INGRESO",montoMinor:10000,externalId:"evidencia-ingreso"});
 const gasto=await registrarTransaccion(usuarioId,{...datos,tipo:"GASTO",montoMinor:2000,externalId:"evidencia-gasto"});
 const fuentes=await Tx.find({usuarioId}).sort({_id:1}).lean();
 const correccion=await aplicar({usuarioId,movimientoId:String(gasto._id),tipo:"CORRECCION",cambios:{montoMinor:1800},idempotencyKey:"evidencia-corregida"});
 const estado=async()=>({acciones:await Accion.find({usuarioId}).sort({_id:1}).lean(),
  outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean(),cursor:await Cursor.findById(String(usuarioId)).lean()});
 const completar=(a,tx,monto)=>actualizarAccion(usuarioId,a._id,{estado:"COMPLETADA",transaccionEvidenciaId:tx._id,resultadoMinor:monto});
 async function rechazar(operacion,codigo=422){const antes=await estado();await assert.rejects(operacion(),e=>e.statusCode===codigo);assert.deepEqual(await estado(),antes);}
 const a=await accion("GASTO");
 await rechazar(()=>completar(a,gasto,2000));
 const final=await completar(a,gasto,1800);assert.equal(final.estado,"COMPLETADA");
 const evento=await Outbox.findOne({usuarioId,aggregateId:a._id,eventName:"ACCION_PROGRESO_ACTUALIZADA"}).lean();
 assert.equal(evento.payload.evidenciaContable.montoMinor,1800);
 assert.equal(evento.payload.evidenciaContable.compensacionHash,correccion.hashActual);
 await rechazar(()=>completar(a,gasto,1800),409);
 await aplicar({usuarioId,movimientoId:String(gasto._id),tipo:"ANULACION",idempotencyKey:"evidencia-anulada"});
 const anulada=await accion("GASTO");await rechazar(()=>completar(anulada,gasto,100));
 const incompatible=await accion("GASTO");await rechazar(()=>completar(incompatible,ingreso,100));
 await rechazar(()=>actualizarAccion(new mongoose.Types.ObjectId(),incompatible._id,
  {estado:"COMPLETADA",transaccionEvidenciaId:ingreso._id,resultadoMinor:100}),404);
 const ajeno=await Tx.create({...datos,usuarioId:new mongoose.Types.ObjectId(),tipo:"INGRESO",montoMinor:100});
 const propia=await accion("INGRESOS");await rechazar(()=>completar(propia,ajeno,100));
 const rollback=await accion("INGRESOS"),antes=await estado(),crear=Outbox.create;
 Outbox.create=async()=>{throw Error("OUTBOX_EVIDENCIA_FALLIDO");};
 try{await assert.rejects(completar(rollback,ingreso,100),/OUTBOX_EVIDENCIA_FALLIDO/);}finally{Outbox.create=crear;}
 assert.deepEqual(await estado(),antes);
 const p=await Prestamo.create({usuarioId,direccion:"POR_COBRAR",origenCuentaPorCobrar:"TRABAJO",
  contraparte:"Cliente",principalMinor:100,saldoMinor:0,estado:"PAGADO",fechaInicio:fecha});
 const trabajo=await Tx.create({...datos,usuarioId,prestamoId:p._id,tipo:"INGRESO",montoMinor:100});
 const cobro=await accion("COBRO");assert.equal((await completar(cobro,trabajo,100)).estado,"COMPLETADA");
 assert.deepEqual(await Tx.find({_id:{$in:fuentes.map(t=>t._id)}}).sort({_id:1}).lean(),fuentes);
}
module.exports={probarEvidenciaProgresoAutorizada};
