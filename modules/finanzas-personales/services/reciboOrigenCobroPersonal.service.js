"use strict";
const mongoose=require("mongoose"),C=require("./correccionPrestamoPersonal.service"),P=require("../models/prestamoPersonal.model"),E=require("../models/correccionPrestamoPersonal.model");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c}),oid=s=>typeof s==="string"&&/^[a-f0-9]{24}$/i.test(s),clave=s=>typeof s==="string"&&/^origen_cobro_[A-Za-z0-9_-]{8,80}$/.test(s),hex=s=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s);
function publico(usuarioId,prestamoId,solicitudId,cambios,hash,duplicado){
 const u=String(usuarioId),p=String(prestamoId);if(!oid(u)||!oid(p)||!clave(solicitudId)||!hex(hash)||typeof duplicado!=="boolean"||!cambios||Object.keys(cambios).sort().join(",")!=="origenCuentaPorCobrar,versionOrigen"||!hex(cambios.versionOrigen)||!["TRABAJO","PRESTAMO","OTRO"].includes(cambios.origenCuentaPorCobrar))throw falla("Recibo de origen no verificable");
 return{confirmado:true,usuarioId:u.toLowerCase(),prestamoId:p.toLowerCase(),solicitudId,versionOrigen:cambios.versionOrigen,origenCuentaPorCobrar:cambios.origenCuentaPorCobrar,hash,duplicado,certificaEstadoActual:false,afectaCaja:false};
}
function desdeEvento(usuarioId,prestamoId,solicitudId,e){
 if(!e||String(e.usuarioId)!==String(usuarioId)||String(e.prestamoId)!==String(prestamoId)||e.solicitudId!==solicitudId||e.hashActual!==C.hash(e)||e.solicitudHash!==C.digest(e.cambios))throw falla("Confirmación de origen no verificable");
 const datos=C.validar(usuarioId,prestamoId,e.cambios,{confirmacion:true,solicitudId});
 if(e.anterior?.direccion!=="POR_COBRAR"||e.posterior?.direccion!=="POR_COBRAR"||e.posterior.origenCuentaPorCobrar!==datos.origenCuentaPorCobrar||!Number.isSafeInteger(e.anterior.principalMinor)||e.anterior.principalMinor<1||!Number.isSafeInteger(e.anterior.saldoMinor)||e.anterior.saldoMinor<0||e.anterior.saldoMinor>e.anterior.principalMinor||e.posterior.principalMinor!==e.anterior.principalMinor||e.posterior.saldoMinor!==e.anterior.saldoMinor)throw falla("Confirmación de origen alteró importes o dirección");
 return publico(usuarioId,prestamoId,solicitudId,datos,e.hashActual,true);
}
async function consultar(usuarioId,prestamoId,solicitudId){
 if(!oid(String(usuarioId))||!oid(String(prestamoId))||!clave(solicitudId))throw falla("Identificador de recibo inválido",400);
 usuarioId=String(usuarioId).toLowerCase();prestamoId=String(prestamoId).toLowerCase();
 await C.exigirIndices();const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  const p=await P.findOne({_id:prestamoId,usuarioId}).maxTimeMS(5000).session(session).lean();if(!p||p.direccion!=="POR_COBRAR")throw falla("Confirmación de origen no encontrada",404);
  const eventos=await E.find({usuarioId,prestamoId}).sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean(),ultimo=C.verificar(eventos,p);
  if(ultimo&&ultimo.posterior?.origenCuentaPorCobrar!==p.origenCuentaPorCobrar)throw falla("Origen actual no coincide con la corrección auditada");
  const e=eventos.find(e=>e.solicitudId===solicitudId);if(!e||e.cambios?.versionOrigen===undefined||e.cambios?.revisarCobrosTrabajo===true)throw falla("Confirmación de origen no encontrada",404);
  const reciboOrigen=desdeEvento(usuarioId,prestamoId,solicitudId,e);
  // Verifica integridad financiera actual sin comparar una selección histórica con la actual.
  await require("./seleccionOrigenCobroPersonal.service").enSesion(usuarioId,p,eventos,session);
  resultado={soloLectura:true,reciboOrigen,detalle:"Confirmación histórica verificada sin reenviar ni cambiar caja. No certifica origen real, saldo ni estado actual."};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={publico,desdeEvento,consultar};
