"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Credito=require("../models/credito.model"),Prestamo=require("../models/prestamoPersonal.model");
const Evento=require("../models/retiroCreditoLegacyPersonal.model"),Outbox=require("../models/outboxPersonal.model");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const MAX=1000,GENESIS="0".repeat(64),falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const igual=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
function foto(p){const d=p.toObject?p.toObject():p;return canon(Object.fromEntries(Object.entries(d).filter(([k])=>!["_id","userId","__v","createdAt","updatedAt","retiroRevision","retiroHash"].includes(k))));}
function hash(e){return crypto.createHash("sha256").update(JSON.stringify(canon(Object.fromEntries(["usuarioId","creditoId","secuencia","solicitudId","tipo","referencia","prestamoIncorporadoId","anterior","posterior","fecha","hashAnterior"].map(k=>[k,e[k]]))))).digest("hex");}
function verificar(eventos,p){
 let prev=GENESIS,estado="ACTIVO";
 if(eventos.length>MAX)throw falla("Historial de crédito supera la capacidad verificable");
 for(let i=0;i<eventos.length;i++){
  const e=eventos[i],restaura=e.tipo==="RESTAURACION",incorpora=e.tipo==="INCORPORACION";
  const tipoValido=estado==="ACTIVO"?["RETIRO","INCORPORACION"].includes(e.tipo):estado==="RETIRADO"&&restaura;
  if(!tipoValido||e.secuencia!==i+1||String(e.usuarioId)!==String(p.userId)||String(e.creditoId)!==String(p._id)||e.hashAnterior!==prev||hash(e)!==e.hashActual||
   (restaura?(e.referencia!==prev||!igual(e.anterior,eventos[i-1].posterior)||!igual(e.posterior,eventos[i-1].anterior)):e.referencia!==null)||
   (!restaura&&(!igual(e.posterior,{...e.anterior,activo:false})||e.anterior.activo!==true))||
   (incorpora?!mongoose.isValidObjectId(e.prestamoIncorporadoId):e.prestamoIncorporadoId!==null))throw falla("Historial de crédito no verificable");
  estado=restaura?"ACTIVO":incorpora?"INCORPORADO":"RETIRADO";prev=e.hashActual;
 }
 if((p.retiroRevision||0)!==eventos.length||(p.retiroHash||GENESIS)!==prev)throw falla("Cursor de crédito no verificable");
 return eventos.at(-1);
}
function indiceLegacyValido(indices){return indices.some(i=>i.unique===true&&i.sparse!==true&&i.expireAfterSeconds===undefined&&(!i.collation||i.collation.locale==="simple")&&
 JSON.stringify(i.key)==='{"usuarioId":1,"legacyCreditoId":1}'&&igual(i.partialFilterExpression,{legacyCreditoId:{$type:"objectId"}}));}
async function exigirIndices(){
 let indices,prestamos;try{indices=await Evento.collection.indexes();prestamos=await Prestamo.collection.indexes();}catch{throw falla("Índices de crédito no disponibles",503);}
 if(!indiceExacto(indices,["usuarioId","creditoId","secuencia"])||!indiceExacto(indices,["usuarioId","solicitudId"])||!indiceLegacyValido(prestamos))throw falla("Índices de crédito no verificados",503);
}
function validar(usuarioId,creditoId,s,tipo){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(creditoId)||s?.confirmacion!==true||typeof s.solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(s.solicitudId))throw falla("Confirma la operación con identificador de reintento y crédito válidos",400);
 if(tipo==="RESTAURACION"&&!/^[a-f0-9]{64}$/.test(s.retiroHash||""))throw falla("Referencia de retiro requerida",400);
}
async function buscarCoincidente(p,usuarioId,session){
 // Todos los estados: saldar o retirar la proyección no autoriza a duplicarla.
 return Prestamo.findOne({usuarioId,direccion:"POR_PAGAR",$or:[{legacyCreditoId:p._id},{concepto:p.nombre,principalMinor:p.saldo}]}).session(session).maxTimeMS(5000).lean();
}
async function operar(usuarioId,creditoId,s,tipo){
 validar(usuarioId,creditoId,s,tipo);await exigirIndices();const session=await mongoose.startSession();let resultado;
 try{
  await session.withTransaction(async()=>{
   const p=await Credito.findOne({_id:creditoId,userId:usuarioId,activo:{$in:[true,false]}}).session(session).lean();if(!p)throw falla("Crédito anterior no encontrado",404);
   const eventos=await Evento.find({usuarioId,creditoId}).sort({secuencia:1}).limit(MAX+1).maxTimeMS(5000).session(session).lean(),ultimo=verificar(eventos,p);
   const replay=await Evento.findOne({usuarioId,solicitudId:s.solicitudId}).session(session).lean();
   if(replay){
    if(String(replay.creditoId)!==String(creditoId)||replay.tipo!==tipo||(replay.referencia||null)!==(tipo==="RESTAURACION"?s.retiroHash:null))throw falla("Identificador de reintento usado en otra operación");
    if(replay.tipo==="INCORPORACION"&&!await Prestamo.exists({_id:replay.prestamoIncorporadoId,usuarioId,legacyCreditoId:p._id}).session(session))throw falla("La deuda incorporada ya no tiene un vínculo verificable; requiere revisión");
    resultado={id:replay.prestamoIncorporadoId?String(replay.prestamoIncorporadoId):String(p._id),creditoId:String(p._id),hash:replay.hashActual,duplicado:true,vigente:ultimo?.hashActual===replay.hashActual&&igual(foto(p),replay.posterior)};return;
   }
   if(eventos.length>=MAX)throw falla("Historial de crédito supera la capacidad verificable");
   if(await buscarCoincidente(p,usuarioId,session))throw falla("Existe una deuda coincidente o ya incorporada, incluso pagada o retirada. Requiere revisión para evitar duplicarla");
   const anterior=foto(p);let posterior,prestamoIncorporadoId=null;
   if(tipo==="RESTAURACION"){
    if(!ultimo||ultimo.tipo!=="RETIRO"||ultimo.hashActual!==s.retiroHash||p.activo!==false||!igual(anterior,ultimo.posterior))throw falla("Retiro anterior sin evidencia vigente o crédito modificado; requiere revisión");
    posterior=ultimo.anterior;
   }else{
    if(p.activo!==true||ultimo?.tipo==="INCORPORACION")throw falla("Crédito inactivo o incorporado; no se puede inferir su estado anterior");
    posterior={...anterior,activo:false};
    if(tipo==="INCORPORACION"){
     if(!Number.isSafeInteger(p.saldo)||p.saldo<=0||!Number.isSafeInteger(p.cuotaMensual)||p.cuotaMensual<0||!Number.isFinite(p.tasaMensualPct)||p.tasaMensualPct<0||p.tasaMensualPct>100||!(p.createdAt instanceof Date)||!Number.isFinite(p.createdAt.getTime())||p.createdAt.getTime()>Date.now())throw falla("Valores del crédito requieren revisión",422);
     const [nuevo]=await Prestamo.create([{usuarioId,legacyCreditoId:p._id,direccion:"POR_PAGAR",contraparte:"Acreedor por identificar",concepto:p.nombre,principalMinor:p.saldo,saldoMinor:p.saldo,tasaMensualPct:p.tasaMensualPct,tasaConfirmada:true,cuotaMinor:p.cuotaMensual,fechaInicio:p.createdAt,fechaVencimiento:null,periodicidad:null,periodicidadConfirmada:false}],{session});prestamoIncorporadoId=nuevo._id;
    }
   }
   const e={usuarioId:p.userId,creditoId:p._id,secuencia:eventos.length+1,solicitudId:s.solicitudId,tipo,referencia:tipo==="RESTAURACION"?s.retiroHash:null,prestamoIncorporadoId,anterior,posterior,fecha:new Date(),hashAnterior:ultimo?.hashActual||GENESIS};e.hashActual=hash(e);
   await Evento.create([e],{session});
   const cambio=await Credito.updateOne({_id:p._id,userId:usuarioId},{$set:{activo:posterior.activo,retiroRevision:e.secuencia,retiroHash:e.hashActual}},{session});
   if(cambio.matchedCount!==1)throw falla("El crédito cambió durante la operación");
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"CREDITO_LEGACY_PERSONAL",aggregateId:p._id,payload:{accion:tipo,creditoAnteriorId:String(p._id),prestamoId:prestamoIncorporadoId?String(prestamoIncorporadoId):null,cicloEventoHash:e.hashActual,saldoConservadoMinor:p.saldo}}],{session});
   resultado={id:String(prestamoIncorporadoId||p._id),creditoId:String(p._id),hash:e.hashActual,duplicado:false,vigente:true};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return resultado;
 }finally{await session.endSession();}
}
async function listar(usuarioId){
 const filas=await Credito.find({userId:usuarioId}).sort({createdAt:-1}).limit(MAX+1).maxTimeMS(5000).lean();
 if(filas.length>MAX)throw falla("Listado de créditos incompleto: supera la capacidad verificable",422);
 const vinculados=await Prestamo.find({usuarioId,legacyCreditoId:{$in:filas.map(p=>p._id)}}).select("legacyCreditoId").limit(MAX+1).maxTimeMS(5000).lean();
 if(vinculados.length>MAX)throw falla("Vínculos de créditos incompletos",422);
 const incorporados=new Set(vinculados.map(p=>String(p.legacyCreditoId)));
 const inactivos=filas.filter(p=>p.activo!==true&&!incorporados.has(String(p._id)));
 const eventos=await Evento.find({usuarioId,creditoId:{$in:inactivos.map(p=>p._id)}}).sort({secuencia:1}).limit(5001).maxTimeMS(5000).lean();
 if(eventos.length>5000)throw falla("Historial de créditos incompleto: supera la capacidad verificable",422);
 const porCredito=new Map();for(const e of eventos){const key=String(e.creditoId);if(!porCredito.has(key))porCredito.set(key,[]);porCredito.get(key).push(e);}
 return {creditos:filas.filter(p=>p.activo===true),retirados:inactivos.map(p=>{
  let disponible=false;try{const ultimo=verificar(porCredito.get(String(p._id))||[],p);disponible=ultimo?.tipo==="RETIRO"&&igual(foto(p),ultimo.posterior);}catch(e){if(e.statusCode!==409)throw e;}
  return {...p,recuperacion:{disponible:disponible===true,retiroHash:disponible?p.retiroHash:null}};
 })};
}
module.exports={foto,hash,verificar,indiceLegacyValido,exigirIndices,listar,retirar:(u,p,s)=>operar(u,p,s,"RETIRO"),restaurar:(u,p,s)=>operar(u,p,s,"RESTAURACION"),incorporar:(u,p,s)=>operar(u,p,s,"INCORPORACION")};
