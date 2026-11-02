"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Recibo=require("../models/reciboAprobacionPersonal.model"),Borrador=require("../models/borradorFinanciero.model");
const modelos={TRANSACCION:require("../models/TransaccionPersonal"),PRESTAMO:require("../models/prestamoPersonal.model"),CUENTA:require("../models/cuentaFinanciera.model")};
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
const versionBorrador=b=>digest(b?.toObject?b.toObject():b);
const solicitudHash=(borradorId,itemId,version)=>digest({borradorId:String(borradorId),itemId:itemId?String(itemId):null,version:version||null});
function hash(r){return digest(Object.fromEntries(["usuarioId","borradorId","itemId","solicitudId","solicitudHash","itemIds","original","resultado","fuentes","fecha"].map(k=>[k,r[k]])));}
function validarSolicitud(usuarioId,borradorId,itemId,s){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(borradorId)||(itemId&&!mongoose.isValidObjectId(itemId))||s?.confirmacion!==true||typeof s.versionBorrador!=="string"||!/^[a-f0-9]{64}$/.test(s.versionBorrador)||typeof s.solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(s.solicitudId))throw falla("Confirma la aprobación con un identificador estable válido",400);
}
async function exigirIndices(){let indices;try{indices=await Recibo.collection.indexes();}catch{throw falla("Índices de recibos no disponibles",503);}
 if(!indiceExacto(indices,["usuarioId","solicitudId"])||!indiceExacto(indices,["usuarioId","borradorId","itemIds"]))throw falla("Índices de recibos no verificados",503);
}
function verificar(r){
 if(!r||String(r.original?._id)!==String(r.borradorId)||String(r.original?.usuarioId)!==String(r.usuarioId)||String(r.resultado?.borradorId)!==String(r.borradorId)||r.hashActual!==hash(r)||r.solicitudHash!==solicitudHash(r.borradorId,r.itemId,versionBorrador(r.original))||!Array.isArray(r.itemIds)||!r.itemIds.length||r.itemIds.length>100||new Set(r.itemIds.map(String)).size!==r.itemIds.length||!Array.isArray(r.fuentes)||!r.fuentes.length||r.fuentes.length>300)throw falla("Recibo de aprobación no verificable");
 for(const f of r.fuentes)if(!modelos[f.modelo]||!mongoose.isValidObjectId(f.id)||f.hash!==digest(f.original)||String(f.original?._id)!==String(f.id)||String(f.original?.usuarioId)!==String(r.usuarioId))throw falla("Fuente del recibo no verificable");return r;
}
async function leerFuente(modelo,id,usuarioId,session){return modelos[modelo].collection.findOne({_id:new mongoose.Types.ObjectId(String(id)),usuarioId:new mongoose.Types.ObjectId(String(usuarioId))},{session,maxTimeMS:5000});}
async function verificarFuentes(r,session){
 verificar(r);const b=await Borrador.findOne({_id:r.borradorId,usuarioId:r.usuarioId}).session(session).lean();if(!b)throw falla("El borrador original requiere revisión");
 for(const f of r.fuentes){const actual=await leerFuente(f.modelo,f.id,r.usuarioId,session);
  if(!actual||(f.modelo==="TRANSACCION"&&digest(actual)!==f.hash))throw falla("Las fuentes de la aprobación requieren revisión");
 }
 return r;
}
async function buscarEnSesion(usuarioId,solicitudId,session){return Recibo.findOne({usuarioId,solicitudId}).session(session).maxTimeMS(5000).lean();}
async function crearEnSesion({usuarioId,borradorId,itemId,solicitudId,original,itemIds,resultado},session){
 if(!session?.inTransaction())throw falla("El recibo requiere la transacción de aprobación");
 const refs=[];for(const o of resultado.operaciones){
  if(["TRANSFERENCIA_PROPIA","AHORRO_ACTIVO"].includes(o.tipo)){refs.push({modelo:"CUENTA",id:o.origenId},{modelo:"CUENTA",id:o.destinoId});}
  else refs.push({modelo:["DEUDA_POR_PAGAR","CUENTA_POR_COBRAR"].includes(o.tipo)?"PRESTAMO":o.tipo==="AJUSTE_SALDO_AHORRO"?"CUENTA":"TRANSACCION",id:o.id});
  if(o.prestamoId)refs.push({modelo:"PRESTAMO",id:o.prestamoId});
 }
 const fuentes=[],vistos=new Set();for(const ref of refs){if(!modelos[ref.modelo]||!mongoose.isValidObjectId(ref.id))throw falla("Operación sin fuente identificada");const key=ref.modelo+":"+ref.id;if(vistos.has(key))continue;vistos.add(key);
  const fuente=await leerFuente(ref.modelo,ref.id,usuarioId,session);if(!fuente)throw falla("Fuente de aprobación ausente");fuentes.push({...ref,original:canon(fuente),hash:digest(fuente)});
 }
 const r={usuarioId,borradorId,itemId:itemId||null,solicitudId,solicitudHash:solicitudHash(borradorId,itemId,versionBorrador(original)),itemIds,original:canon(original),resultado:canon(resultado),fuentes,fecha:new Date()};r.hashActual=hash(r);verificar(r);
 if(Buffer.byteLength(JSON.stringify(canon(r)))>1024*1024)throw falla("Recibo supera capacidad verificable",422);
 await Recibo.create([r],{session});return r;
}
function resumen(r){return{confirmado:true,versionBorrador:versionBorrador(r.original),solicitudId:r.solicitudId,hash:r.hashActual,borradorId:String(r.borradorId),itemId:r.itemId?String(r.itemId):null,ruta:"/captura/"+r.borradorId+(r.itemId?"/items/"+r.itemId:"")+"/aprobar",metodo:"POST",certificaEstadoActual:false};}
async function consultar(usuarioId,solicitudId){
 if(!mongoose.isValidObjectId(usuarioId)||typeof solicitudId!=="string"||!/^[A-Za-z0-9_-]{8,100}$/.test(solicitudId))throw falla("Identificador de recibo inválido",400);
 await exigirIndices();const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{const r=await buscarEnSesion(usuarioId,solicitudId,session);if(!r)throw falla("No hay recibo verificable de esa aprobación; continúa sin confirmar",404);await verificarFuentes(r,session);resultado=resumen(r);},{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={versionBorrador,validarSolicitud,solicitudHash,hash,verificar,exigirIndices,buscarEnSesion,crearEnSesion,verificarFuentes,resumen,consultar};
