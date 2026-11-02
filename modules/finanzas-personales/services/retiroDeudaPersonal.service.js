"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Prestamo=require("../models/prestamoPersonal.model"),Evento=require("../models/retiroDeudaPersonal.model");
const Tx=require("../models/TransaccionPersonal"),Outbox=require("../models/outboxPersonal.model");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const GENESIS="0".repeat(64),MAX=1000;
const falla=(mensaje,statusCode=409)=>Object.assign(new Error(mensaje),{statusCode});
function canon(v){if(v instanceof Date)return v.toISOString();if(v===null||typeof v!=="object")return v;if(v instanceof mongoose.Types.ObjectId)return String(v);if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const iguales=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
function foto(p){const d=p.toObject?p.toObject():p;return Object.fromEntries(Object.entries(d).filter(([k])=>!["_id","usuarioId","__v","createdAt","updatedAt","retiroRevision","retiroHash","correccionRevision","correccionHash"].includes(k)).map(([k,v])=>[k,canon(v)]));}
function hash(e){return crypto.createHash("sha256").update(JSON.stringify(canon(Object.fromEntries(["usuarioId","prestamoId","secuencia","solicitudId","tipo","referencia","anterior","posterior","fecha","hashAnterior"].map(k=>[k,e[k]]))))).digest("hex");}
function verificar(eventos,p){
 if(eventos.length>MAX)throw falla("Historial de retiros supera la capacidad verificable");
 let prev=GENESIS;
 for(let i=0;i<eventos.length;i++){
  const e=eventos[i];
  if(String(e.usuarioId)!==String(p.usuarioId)||String(e.prestamoId)!==String(p._id)||e.secuencia!==i+1||e.hashAnterior!==prev||hash(e)!==e.hashActual||
   e.tipo!==(i%2===0?"RETIRO":"RESTAURACION")||(e.tipo==="RESTAURACION"&&!iguales(e.anterior,eventos[i-1].posterior))||
   (e.tipo==="RETIRO"&&e.referencia!==null)||(e.tipo==="RESTAURACION"&&e.referencia!==prev))throw falla("Historial de retiros no verificable");
  prev=e.hashActual;
 }
 if((p.retiroRevision||0)!==eventos.length||(p.retiroHash||GENESIS)!==prev)throw falla("Cursor de retiros no verificable");
 return eventos.at(-1);
}
async function exigirIndices(){
 let indices;try{indices=await Evento.collection.indexes();}catch{throw falla("Índices de recuperación no disponibles",503);}
 if(!indiceExacto(indices,["usuarioId","prestamoId","secuencia"])||!indiceExacto(indices,["usuarioId","solicitudId"]))throw falla("Índices de recuperación no verificados",503);
}
function validar(s){
 if(s?.confirmacion!==true||typeof s.solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(s.solicitudId))throw falla("Confirma explícitamente la operación y conserva su identificador de reintento",400);
}
async function operar(usuarioId,prestamoId,s,tipo){
 validar(s);if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(prestamoId))throw falla("Identificador inválido",400);
 if(tipo==="RESTAURACION"&&!/^[a-f0-9]{64}$/.test(s.retiroHash||""))throw falla("Referencia de retiro requerida",400);
 await exigirIndices();const session=await mongoose.startSession();let resultado;
 try{
  await session.withTransaction(async()=>{
   const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR"}).session(session);
   if(!p)throw falla("Deuda no encontrada",404);
   const eventos=await Evento.find({usuarioId,prestamoId}).sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean();
   const ultimo=verificar(eventos,p),replay=await Evento.findOne({usuarioId,solicitudId:s.solicitudId}).session(session).lean();
   if(replay){
    if(String(replay.prestamoId)!==String(prestamoId)||replay.tipo!==tipo||(replay.referencia||null)!==(tipo==="RESTAURACION"?s.retiroHash:null))throw falla("Identificador de reintento usado en otra operación");
    resultado={id:String(p._id),hash:replay.hashActual,duplicado:true,vigente:ultimo?.hashActual===replay.hashActual&&iguales(foto(p),replay.posterior)};return;
   }
   if(eventos.length>=MAX)throw falla("Historial de retiros supera la capacidad verificable");
   // No retirar deudas con pagos, ni siquiera anulados: requieren su flujo contable.
   if(await Tx.exists({usuarioId,prestamoId:p._id}).session(session))throw falla("Esta deuda tiene movimientos vinculados; requiere revisión contable");
   const anterior=foto(p);let posterior;
   if(tipo==="RETIRO"){
    if(!["ACTIVO","VENCIDO"].includes(p.estado)||!Number.isSafeInteger(p.saldoMinor)||p.saldoMinor<=0)throw falla("Solo se retiran deudas pendientes; un retiro antiguo sin evidencia requiere revisión");
    posterior={...anterior,estado:"CANCELADO",periodicidadConfirmada:false};
   }else{
    if(!ultimo||ultimo.tipo!=="RETIRO"||ultimo.hashActual!==s.retiroHash||p.estado!=="CANCELADO"||!iguales(anterior,ultimo.posterior))throw falla("El retiro no está vigente o la deuda cambió; requiere revisión");
    posterior=ultimo.anterior;
   }
   const e={usuarioId:p.usuarioId,prestamoId:p._id,secuencia:eventos.length+1,solicitudId:s.solicitudId,tipo,referencia:tipo==="RESTAURACION"?s.retiroHash:null,anterior,posterior,fecha:new Date(),hashAnterior:ultimo?.hashActual||GENESIS};e.hashActual=hash(e);
   await Evento.create([e],{session});
   p.estado=posterior.estado;p.periodicidadConfirmada=posterior.periodicidadConfirmada;p.retiroRevision=e.secuencia;p.retiroHash=e.hashActual;await p.save({session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"PRESTAMO_PERSONAL",aggregateId:p._id,payload:{accion:tipo==="RETIRO"?"RETIRAR_DE_VISTA":"RESTAURAR_EN_VISTA",prestamoId:String(p._id),retiroEventoHash:e.hashActual,saldoConservadoMinor:p.saldoMinor}}],{session});
   resultado={id:String(p._id),hash:e.hashActual,duplicado:false,vigente:true};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return resultado;
 }finally{await session.endSession();}
}
module.exports={foto,hash,verificar,exigirIndices,retirar:(u,p,s)=>operar(u,p,s,"RETIRO"),restaurar:(u,p,s)=>operar(u,p,s,"RESTAURACION")};
