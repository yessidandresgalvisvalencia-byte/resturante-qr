"use strict";
const mongoose=require("mongoose");
const C=require("./correccionPrestamoPersonal.service");
const P=require("../models/prestamoPersonal.model");
const E=require("../models/correccionPrestamoPersonal.model");
const CONTRATO="FP_RECIBO_REVISION_ORIGEN_TRABAJO_V1";
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
const oid=s=>typeof s==="string"&&/^[a-f0-9]{24}$/i.test(s);
const clave=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{8,100}$/.test(s);
function desdeEvento(usuarioId,prestamoId,solicitudId,e){
 const u=String(usuarioId).toLowerCase(),id=String(prestamoId).toLowerCase();
 if(!oid(u)||!oid(id)||!clave(solicitudId))throw falla("Identificador de recibo inválido",400);
 if(!e||String(e.usuarioId)!==u||String(e.prestamoId)!==id||e.solicitudId!==solicitudId||e.hashActual!==C.hash(e)||e.solicitudHash!==C.digest(e.cambios))throw falla("Revisión de origen no verificable");
 const c=C.validar(u,id,e.cambios,{confirmacion:true,solicitudId});
 const campos=Object.keys(c).sort().join(",");
 if(c.origenCuentaPorCobrar!=="TRABAJO"||c.revisarCobrosTrabajo!==true||!["origenCuentaPorCobrar,revisarCobrosTrabajo","origenCuentaPorCobrar,revisarCobrosTrabajo,versionOrigen"].includes(campos))throw falla("Recibo de otro contrato",404);
 const a=e.anterior,p=e.posterior;
 const sinOrigen=v=>Object.fromEntries(Object.entries(v).filter(([k])=>k!=="origenCuentaPorCobrar"));
 C.verificarCierre(e);
 if(!a||!p||a.direccion!=="POR_COBRAR"||p.direccion!=="POR_COBRAR"||(e.noAplicada!==true&&p.origenCuentaPorCobrar!=="TRABAJO")||!Number.isSafeInteger(a.principalMinor)||a.principalMinor<1||!Number.isSafeInteger(a.saldoMinor)||a.saldoMinor<0||a.saldoMinor>a.principalMinor||C.digest(sinOrigen(a))!==C.digest(sinOrigen(p)))throw falla("Revisión de origen alteró otros datos");
 const path="/cuentas-por-cobrar/"+id+"/corregir-origen-trabajo";
 const body={confirmacion:true,...(c.versionOrigen!==undefined?{versionOrigen:c.versionOrigen}:{})};
 return{contrato:CONTRATO,confirmado:true,usuarioId:u,prestamoId:id,solicitudId,metodo:"POST",path,body,
  huellaSolicitud:C.digest({cuerpo:body,metodo:"POST",path}),hashEvento:e.hashActual,...(e.noAplicada?{noAplicada:true,motivoNoAplicada:e.motivoNoAplicada}:{}),
  solicitudHistoricaSinVersion:c.versionOrigen===undefined,certificaEstadoActual:false,afectaCaja:false};
}
async function leer(usuarioId,prestamoId,solicitudId){
 if(!oid(String(usuarioId))||prestamoId!==null&&!oid(String(prestamoId))||!clave(solicitudId))throw falla("Identificador de recibo inválido",400);
 usuarioId=String(usuarioId).toLowerCase();prestamoId=prestamoId===null?null:String(prestamoId).toLowerCase();
 await C.exigirIndices();const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  let id=prestamoId;if(id===null){const e=await E.findOne({usuarioId,solicitudId}).maxTimeMS(5000).session(session).lean();if(!e)throw falla("Revisión de origen no encontrada",404);id=String(e.prestamoId);if(!oid(id))throw falla("Referencia de revisión no verificable");}
  const p=await P.findOne({_id:id,usuarioId}).maxTimeMS(5000).session(session).lean();
  if(!p||p.direccion!=="POR_COBRAR")throw falla("Revisión de origen no encontrada",404);
  const eventos=await E.find({usuarioId,prestamoId:id}).sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean();
  const ultimo=C.verificar(eventos,p);
  if(ultimo&&ultimo.posterior?.origenCuentaPorCobrar!==p.origenCuentaPorCobrar)throw falla("Origen actual no coincide con la corrección auditada");
  const e=eventos.find(e=>e.solicitudId===solicitudId);
  if(!e||e.cambios?.revisarCobrosTrabajo!==true)throw falla("Revisión de origen no encontrada",404);
  const reciboRevisionOrigen=desdeEvento(usuarioId,id,solicitudId,e);
  await require("./seleccionOrigenCobroPersonal.service").enSesion(usuarioId,p,eventos,session);
  resultado={soloLectura:true,reciboRevisionOrigen,detalle:"Revisión histórica verificada sin reenviar ni modificar caja. No certifica origen real, saldo ni estado actual."};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;
 }finally{await session.endSession();}
}
const consultar=(usuarioId,prestamoId,solicitudId)=>leer(usuarioId,prestamoId,solicitudId);
const consultarPorClave=(usuarioId,solicitudId)=>leer(usuarioId,null,solicitudId);
async function cerrarSinAplicar(usuarioId,prestamoId,solicitud){
 usuarioId=String(usuarioId).toLowerCase();prestamoId=String(prestamoId).toLowerCase();
 const cambios={origenCuentaPorCobrar:"TRABAJO",revisarCobrosTrabajo:true,...(solicitud?.versionOrigen!==undefined?{versionOrigen:solicitud.versionOrigen}:{})};
 await C.corregir(usuarioId,prestamoId,cambios,solicitud,()=>{throw falla("Un cierre no aplica reclasificaciones");},true);
 const r=await consultar(usuarioId,prestamoId,solicitud.solicitudId);
 return{...r,soloLectura:false,detalle:r.reciboRevisionOrigen.noAplicada?"Cierre explícito verificado: esta solicitud no se aplicó y no podrá aplicarse con la misma clave.":"La revisión ya estaba confirmada; el cierre no la anula ni revierte. Conserva su recibo."};
}
module.exports={CONTRATO,desdeEvento,consultar,consultarPorClave,cerrarSinAplicar};
