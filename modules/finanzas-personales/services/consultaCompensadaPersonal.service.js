"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const {vigente}=require("./estadoCompensadoPersonal.service");
const {verificarCadena}=require("./eventoCompensatorioPersonal.service");
const GENESIS="0".repeat(64),MAX_MOVIMIENTOS=5000,MAX_EVENTOS=10000;
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
   concepto:f.concepto,categoria:f.categoria,...(f.tipo==="PAGO_DEUDA"?{impactoCaja:f.impactoCaja}:{})};
  const estado=vigente(original,historial);
  const {usuarioId:_,movimientoId:__,...campos}=estado.actual;
  return Object.freeze({...f,...campos,estado:estado.anulado?"ANULADA":"ACTIVA",
   compensacionHash:historial.at(-1).hashActual});
 });
}
// Para reconstruir saldos desde anclas se conserva el flujo original y se añaden
// los deltas en la fecha de compensación. No reubicar el efecto en la fecha del gasto.
function proyectarCaja(datos){
 proyectar(datos); // valida cadena completa, cursor, fuente y estado de cada movimiento.
 const porId=new Map(datos.fuentes.map(f=>[String(f._id),f]));
 if(datos.eventos.some(e=>!porId.has(e.movimientoId)))integridad();
 const rows=datos.fuentes.filter(f=>f.estado!=="ANULADA").map(f=>({...f}));
 for(const e of datos.eventos){
  const fuente=porId.get(e.movimientoId);if(!fuente)continue;
  const deuda=fuente.tipo==="PAGO_DEUDA";
  if((fuente.impactoCaja!==true&&!(deuda&&fuente.impactoCaja===false))||
     (deuda&&e.tipo!=="ANULACION")||fuente.medioPago==="CREDITO"||fuente.recurrente||
     (fuente.recurrenteOrigenId&&e.tipo!=="ANULACION")||fuente.prestamoId)integridad();
  const delta=BigInt(e.deltaCajaMinor);if(delta===0n)continue;
  const monto=Number(delta<0n?-delta:delta);
  if(!Number.isSafeInteger(monto))integridad();
  rows.push({_id:new mongoose.Types.ObjectId(e.hashActual.slice(0,24)),
   usuarioId:fuente.usuarioId,cuentaId:fuente.cuentaId,cuenta:fuente.cuenta,moneda:"COP",
   tipo:delta>0n?"INGRESO":"GASTO",montoMinor:monto,impactoCaja:true,
   medioPago:fuente.medioPago,estado:"ACTIVA",fecha:new Date(e.fechaISO),
   compensacionHash:e.hashActual,movimientoOrigenId:fuente._id});
 }
 return rows;
}
// Consulta de transición, acotada y sin rutas: fallar explícitamente antes de devolver un
// resultado parcial. Filtros mutables se aplican DESPUÉS de reconstruir el estado vigente.
async function consultarPeriodo({usuarioId,desde,hasta,tipo,categoria,incluirAnuladas=false},{session:externa,modoCaja=false}={}){
 if(!mongoose.isObjectIdOrHexString(usuarioId))throw new TypeError("Usuario inválido");
 if(typeof desde!=="string"||typeof hasta!=="string")throw new TypeError("Período inválido");
 const inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(+inicio)||!Number.isFinite(+fin)||inicio>=fin)throw new TypeError("Período inválido");
 if(tipo!==undefined&&!["INGRESO","GASTO"].includes(tipo)||
    categoria!==undefined&&(typeof categoria!=="string"||!categoria.trim()||categoria.length>80)||
    typeof incluirAnuladas!=="boolean")throw new TypeError("Filtros inválidos");
 if(externa&&(typeof externa.inTransaction!=="function"||!externa.inTransaction()))throw new TypeError("Transacción externa activa requerida");
 const session=externa||await mongoose.startSession();
 try{
  let resultado;
  const leer=async()=>{
   const fuentes=await Transaccion.find({usuarioId,moneda:"COP",fecha:{$gte:inicio,$lt:fin}})
    .sort({fecha:1,_id:1}).limit(MAX_MOVIMIENTOS+1).maxTimeMS(5000).session(session).lean();
   const eventos=await Evento.find({usuarioId:String(usuarioId)},{_id:0}).sort({secuencia:1})
    .limit(MAX_EVENTOS+1).maxTimeMS(5000).session(session).lean();
   if(fuentes.length>MAX_MOVIMIENTOS||eventos.length>MAX_EVENTOS)
    throw Object.assign(new Error("Consulta compensada excede el límite verificable"),{statusCode:422});
   const cursor=await Cursor.findById(String(usuarioId)).maxTimeMS(5000).session(session).lean();
   resultado=(modoCaja?proyectarCaja:proyectar)({usuarioId:String(usuarioId),fuentes,eventos,cursor}).filter(f=>
    (incluirAnuladas||f.estado!=="ANULADA")&&(tipo===undefined||f.tipo===tipo)&&
    (categoria===undefined||f.categoria===categoria));
  };
  if(externa)await leer();
  else await session.withTransaction(leer,{readConcern:{level:"snapshot"},readPreference:"primary"});
  return resultado;
 }finally{if(!externa)await session.endSession();}
}
async function consultarCaja(usuarioId,{session}={}){
 return consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},
  {session,modoCaja:true});
}
module.exports={proyectar,proyectarCaja,consultarPeriodo,consultarCaja};
