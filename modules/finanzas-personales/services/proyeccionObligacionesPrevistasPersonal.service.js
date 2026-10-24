"use strict";
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Cancelacion=require("../models/CancelacionObligacionPrevistaPersonal");
const {programarVencimientosBrutos}=require("./programarVencimientosBrutosPersonal.service");
const LIMITE=10000;
function error(mensaje,statusCode=409){throw Object.assign(new Error(mensaje),{statusCode});}
function proyectarObligaciones({usuarioId,movimientos,cancelaciones,desde,hasta}){
 if(!Array.isArray(movimientos)||!Array.isArray(cancelaciones))
  error("Historial de obligaciones incompleto");
 const inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||inicio>=fin)
  error("Período inválido",400);
 const ids=new Set(),canceladas=new Set();
 for(const m of movimientos){
  if(String(m.usuarioId)!==String(usuarioId)||
   !m._id||!Number.isSafeInteger(m.montoMinor)||m.montoMinor<=0||
   m.tipo!=="GASTO"||m.impactoCaja!==false||m.cuentaId!=null||
   m.cuenta!=="SIN_CAJA"||m.estado!=="ACTIVA")
   error("Obligación no verificable");
  const id=String(m._id);
  if(ids.has(id))error("Obligación duplicada");
  ids.add(id);
 }
 for(const e of cancelaciones){
  const id=String(e.obligacionId);
  if(String(e.usuarioId)!==String(usuarioId)||!ids.has(id)||
   e.tipo!=="CANCELACION_OBLIGACION_PREVISTA"||canceladas.has(id))
   error("Cancelación huérfana, duplicada o ajena");
  const m=movimientos.find(x=>String(x._id)===id);
  if(!e.snapshot||e.snapshot.montoMinor!==m.montoMinor||
   e.snapshot.concepto!==m.concepto||e.snapshot.categoria!==m.categoria||
   new Date(e.snapshot.fecha).getTime()!==new Date(m.fecha).getTime()||
   e.snapshot.frecuencia!==m.frecuencia||
   e.snapshot.recurrente!==m.recurrente)
   error("Snapshot de cancelación distinto al compromiso");
  canceladas.add(id);
 }
 let pendiente=0n,anulado=0n;
 const items=[];
 for(const m of movimientos){
  const fecha=new Date(m.fecha);
  if(!Number.isFinite(fecha.getTime()))error("Vencimiento corrupto");
  if(fecha<inicio||fecha>=fin)continue;
  const cancelada=canceladas.has(String(m._id));
  const monto=BigInt(m.montoMinor);
  if(cancelada)anulado+=monto;else pendiente+=monto;
  items.push({id:String(m._id),concepto:m.concepto,categoria:m.categoria,
   fecha:m.fecha,montoMinor:String(m.montoMinor),
   estado:cancelada?"CANCELADA":"PENDIENTE",impactoCaja:false});
 }
 return {desde:inicio.toISOString(),hasta:fin.toISOString(),
  pendienteMinor:pendiente.toString(),canceladoMinor:anulado.toString(),
  compromisos:items,soloLectura:true,
  alcance:"OBLIGACIONES_PREVISTAS_V81_NO_INCLUYE_CUOTAS_RECURRENTES_GENERADAS"};
}
// Este calendario es BRUTO y no representa deuda restante: los pagos
// vinculados todavía no están descontados. Se mantiene aislado de home.
function proyectarCalendarioBruto({usuarioId,movimientos,cancelaciones,desde,hasta}){
 // Primero verificar TODOS los originales y TODOS los eventos, incluso
 // si quedan fuera de la ventana solicitada.
 proyectarObligaciones({usuarioId,movimientos,cancelaciones,desde,hasta});
 const canceladas=new Set(cancelaciones.map(c=>String(c.obligacionId)));
 let bruto=0n;
 const vencimientos=[];
 for(const m of movimientos){
  const cuotas=programarVencimientosBrutos({origen:m,desde,hasta,
   cancelada:canceladas.has(String(m._id))});
  for(const cuota of cuotas){
   bruto+=BigInt(cuota.montoMinor);
   if(vencimientos.length>=LIMITE)error("Calendario excede límite seguro",503);
   vencimientos.push({obligacionId:String(m._id),concepto:m.concepto,
    fecha:cuota.fecha.toISOString(),montoMinor:String(cuota.montoMinor),
    cobroRealizado:false,estado:"TEORICO_NO_CONCILIADO"});
  }
 }
 vencimientos.sort((a,b)=>a.fecha.localeCompare(b.fecha)||
  a.obligacionId.localeCompare(b.obligacionId));
 return {desde:new Date(desde).toISOString(),hasta:new Date(hasta).toISOString(),
  totalBrutoTeoricoMinor:bruto.toString(),vencimientos,
  soloLectura:true,aptoParaDisponibleHoy:false,
  pagosParcialesConciliados:false};
}
function crearConsultaObligaciones({
 MovimientoModelo=Movimiento,CancelacionModelo=Cancelacion,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function consultar(usuarioId,{desde,hasta}={}){
  if(!mongoose.isValidObjectId(usuarioId))error("Usuario inválido",400);
  const start=new Date(desde),end=new Date(hasta);
  if(!desde||!hasta||!Number.isFinite(start.getTime())||
   !Number.isFinite(end.getTime())||start>=end)error("Período inválido",400);
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    // Consultar ambos historiales sin filtrar por fecha para detectar
    // cancelaciones huérfanas y evitar estado parcial dentro de la ventana.
    const movimientos=await MovimientoModelo.find({usuarioId,
     tipo:"GASTO",impactoCaja:false,cuentaId:null,cuenta:"SIN_CAJA"
    }).limit(LIMITE+1).session(session).lean();
    const cancelaciones=await CancelacionModelo.find({usuarioId})
     .limit(LIMITE+1).session(session).lean();
    if(movimientos.length>LIMITE||cancelaciones.length>LIMITE)
     error("Historial supera límite de verificación",503);
    resultado=proyectarObligaciones({usuarioId,movimientos,cancelaciones,
     desde:start,hasta:end});
   },{readConcern:{level:"snapshot"},readPreference:"primary"});
   return resultado;
  }finally{await session.endSession();}
 };
}
module.exports={proyectarObligaciones,proyectarCalendarioBruto,crearConsultaObligaciones,LIMITE};
