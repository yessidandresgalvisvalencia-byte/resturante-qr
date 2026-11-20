"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),mongoose=require("mongoose");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {registrarTransaccion}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const aplicar=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service").crearAplicador();
const {DOMINIO,payloadAnclaCompensaciones}=require("../../../modules/finanzas-personales/security/anclaCompensacionesPersonal.service");
const {auditarAnclaCompensaciones}=require("../../../modules/finanzas-personales/services/auditoriaAnclaCompensacionesPersonal.service");
async function probarAnclaCompensacionesAutorizada(db){
 const usuarioId=new mongoose.Types.ObjectId(),usuario=String(usuarioId);
 const datos={fecha:new Date(Date.now()-60000),cuenta:"EFECTIVO",concepto:"Ancla de prueba",categoria:"OTROS"};
 await registrarTransaccion(usuarioId,{...datos,tipo:"INGRESO",montoMinor:1000});
 const gasto=await registrarTransaccion(usuarioId,{...datos,tipo:"GASTO",montoMinor:100});
 const primero=await aplicar({usuarioId,movimientoId:String(gasto._id),tipo:"CORRECCION",cambios:{montoMinor:80},idempotencyKey:"ancla-uno"});
 const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519"); // Solo custodio simulado de CI.
 const firmar=e=>{
  const a={version:1,dominio:DOMINIO,algoritmo:"Ed25519",usuarioId:usuario,secuencia:e.secuencia,headHash:e.hashActual,emitidaEn:new Date().toISOString()};
  return {...a,firma:crypto.sign(null,payloadAnclaCompensaciones(a),privateKey).toString("base64")};
 };
 let ultima=firmar(primero);
 const custodio={obtenerUltimaAncla:async(id,opciones)=>{
  assert.equal(id,usuario);assert.equal(opciones.dominio,DOMINIO);assert.ok(opciones.signal instanceof AbortSignal);
  return ultima;
 }};
 const auditar=()=>auditarAnclaCompensaciones({usuarioId,clavePublica:publicKey,custodio});
 const estado=async()=>({fuentes:await Tx.find({usuarioId}).sort({_id:1}).lean(),
  eventos:await Evento.find({usuarioId:usuario}).sort({secuencia:1}).lean(),cursor:await Cursor.findById(usuario).lean(),
  cuentas:await Cuenta.find({usuarioId}).lean(),outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean()});
 const antes=await estado(),resultado=await auditar();assert.equal(resultado.valida,true);
 assert.equal(resultado.certificaCustodiaIndependiente,false);assert.deepEqual(await estado(),antes);
 const segundo=await aplicar({usuarioId,movimientoId:String(gasto._id),tipo:"ANULACION",idempotencyKey:"ancla-dos"});
 assert.equal((await auditar()).secuenciaAnclada,1);
 ultima=firmar(segundo);
 const eventos=db.collection("fin_eventos_compensatorios_personales_v1"),cursores=db.collection("fin_cursor_compensaciones_personales_v1");
 const doc=await eventos.findOne({usuarioId:usuario,secuencia:2}),cursor=await cursores.findOne({_id:usuario});
 await eventos.deleteOne({_id:doc._id});
 await cursores.updateOne({_id:usuario},{$set:{secuencia:1,hashActual:primero.hashActual}});
 try{
  const truncado=await estado();assert.equal((await auditar()).codigo,"ANCLA_NO_COINCIDE");
  assert.deepEqual(await estado(),truncado);
 }finally{await eventos.insertOne(doc);await cursores.replaceOne({_id:usuario},cursor);}
 assert.equal((await auditar()).valida,true);
}
module.exports={probarAnclaCompensacionesAutorizada};
