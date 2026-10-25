"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {verificarCadena}=require("./eventoCompensatorioPersonal.service");
const GENESIS="0".repeat(64),MAX_MOVIMIENTOS=1000,MAX_EVENTOS=10000;
function integridad(){throw new Error("INTEGRIDAD_LEDGER: lectura compensada inconsistente");}
// Recibe la cadena COMPLETA del usuario. Un subconjunto no permite verificar el cursor.
function proyectar({usuarioId,fuentes,eventos,cursor}){
 if(!Array.isArray(fuentes)||!Array.isArray(eventos))integridad();
 if(eventos.some(e=>e.usuarioId!==usuarioId)||
    !verificarCadena(eventos,{prevHash:GENESIS}))integridad();
 if(cursor){
  if(cursor._id!==usuarioId||cursor.secuencia!==eventos.length||
     cursor.hashActual!==(eventos.at(-1)?.hashActual||GENESIS))integridad();
 }else if(eventos.length)integridad();
 const porMovimiento=new Map();
 for(const e of eventos){
  const historial=porMovimiento.get(e.movimientoId)||[];
  historial.push(e);porMovimiento.set(e.movimientoId,historial);
 }
 const ids=new Set();
 return fuentes.map(f=>{
  const id=String(f._id);
  if(String(f.usuarioId)!==usuarioId||ids.has(id))integridad();
  ids.add(id);
  const historial=porMovimiento.get(id)||[];
  if(!historial.length)return Object.freeze({...f});
  if(f.estado!=="ACTIVA")integridad();
  const original={usuarioId,movimientoId:id,tipo:f.tipo,montoMinor:f.montoMinor,
   concepto:f.concepto,categoria:f.categoria};
  const estado=vigente(original,historial);
  const {usuarioId:_,movimientoId:__,...campos}=estado.actual;
  return Object.freeze({...f,...campos,estado:estado.anulado?"ANULADA":"ACTIVA",
   compensacionHash:historial.at(-1).hashActual});
 });
}
// Consulta de transición, acotada y sin rutas: fallar explícitamente antes de devolver un
// resultado parcial. Filtros mutables se aplican DESPUÉS de reconstruir el estado vigente.
async function consultarPeriodo({usuarioId,desde,hasta,tipo,categoria,incluirAnuladas=false}){
 if(!mongoose.isObjectIdOrHexString(usuarioId))throw new TypeError("Usuario inválido");
 if(typeof desde!=="string"||typeof hasta!=="string")throw new TypeError("Período inválido");
 const inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(+inicio)||!Number.isFinite(+fin)||inicio>=fin)throw new TypeError("Período inválido");
 if(tipo!==undefined&&!["INGRESO","GASTO"].includes(tipo)||
    categoria!==undefined&&(typeof categoria!=="string"||!categoria.trim()||categoria.length>80)||
    typeof incluirAnuladas!=="boolean")throw new TypeError("Filtros inválidos");
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   const fuentes=await Transaccion.find({usuarioId,moneda:"COP",fecha:{$gte:inicio,$lt:fin}})
    .sort({fecha:1,_id:1}).limit(MAX_MOVIMIENTOS+1).maxTimeMS(5000).session(session).lean();
   const eventos=await Evento.find({usuarioId:String(usuarioId)},{_id:0}).sort({secuencia:1})
    .limit(MAX_EVENTOS+1).maxTimeMS(5000).session(session).lean();
   if(fuentes.length>MAX_MOVIMIENTOS||eventos.length>MAX_EVENTOS)
    throw Object.assign(new Error("Consulta compensada excede el límite verificable"),{statusCode:422});
   const cursor=await Cursor.findById(String(usuarioId)).maxTimeMS(5000).session(session).lean();
   resultado=proyectar({usuarioId:String(usuarioId),fuentes,eventos,cursor}).filter(f=>
    (incluirAnuladas||f.estado!=="ANULADA")&&(tipo===undefined||f.tipo===tipo)&&
    (categoria===undefined||f.categoria===categoria));
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
module.exports={proyectar,consultarPeriodo};
