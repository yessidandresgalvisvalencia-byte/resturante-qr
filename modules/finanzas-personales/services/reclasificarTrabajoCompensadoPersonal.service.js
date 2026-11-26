"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Prestamo=require("../models/prestamoPersonal.model");
const Outbox=require("../models/outboxPersonal.model");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {crearRegistrador}=require("./registradorCompensacionPersonal.service");
const {serializarEscrituraFuente}=require("./proteccionOriginalCompensadoPersonal.service");
const registrar=crearRegistrador();
const problema=(m,statusCode=409)=>Object.assign(new Error(m),{statusCode});
const config={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
function verificarCuenta(p,usuarioId){
 if(!p||String(p.usuarioId)!==String(usuarioId)||p.direccion!=="POR_COBRAR")throw problema("Cuenta no encontrada",404);
 if(!["ACTIVO","VENCIDO","PAGADO"].includes(p.estado)||!Number.isSafeInteger(p.principalMinor)||p.principalMinor<1||
  !Number.isSafeInteger(p.saldoMinor)||p.saldoMinor<0||p.saldoMinor>p.principalMinor)
  throw problema("Cuenta por cobrar no conciliable");
}
function cobrosConciliados(p,movimientos){
 const cobros=movimientos.filter(m=>String(m.prestamoId)===String(p._id)&&["INGRESO","COBRO_PRESTAMO"].includes(m.tipo));
 let total=0n;
 for(const m of cobros){
  if(!Number.isSafeInteger(m.montoMinor)||m.montoMinor<1||![true,false].includes(m.impactoCaja)||
   m.moneda!=="COP"||m.recurrente||m.recurrenteOrigenId||m.medioPago==="CREDITO"||
   !(m.fecha instanceof Date)||!Number.isFinite(+m.fecha)||+m.fecha>Date.now())
   throw problema("Cobro histórico no conciliable");
  total+=BigInt(m.montoMinor);
 }
 if(!cobros.length||total!==BigInt(p.principalMinor)-BigInt(p.saldoMinor))
  throw problema("Los movimientos no concuerdan con el saldo pendiente; requiere auditoría");
 return {cobros,total:Number(total)};
}
async function movimientosVigentes(usuarioId,session){
 return consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session});
}
async function aplicar(usuarioId,p,{cobros,total},session,origenNuevo="TRABAJO",referencias=null){
 let reclasificados=0;
 const tipoNuevo=origenNuevo==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
 for(const m of cobros){
  if(m.tipo===tipoNuevo)continue;
  const original={usuarioId:String(usuarioId),movimientoId:String(m._id),tipo:m.tipo,
   montoMinor:m.montoMinor,concepto:m.concepto,categoria:m.categoria};
  const evento=await registrar({original,tipo:"CORRECCION",cambios:{tipo:tipoNuevo,categoria:tipoNuevo==="INGRESO"?"Trabajo cobrado":"Cuentas por cobrar"},
   idempotencyKey:"clasif_"+tipoNuevo+"_"+String(m._id)+"_"+(m.compensacionHash||"original"),fechaISO:new Date().toISOString()},{session});
  if(evento.deltaCajaMinor!=="0")throw problema("Reclasificación con efecto de caja inesperado");
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_CORREGIDO",aggregateId:m._id,
   payload:{transaccionId:String(m._id),prestamoId:String(p._id),accion:"RECLASIFICACION_"+origenNuevo,
    compensacionHash:evento.hashActual,secuencia:evento.secuencia,deltaCajaMinor:"0",antes:original,
    despues:{...original,...evento.cambios}}}],{session});
  if(referencias)referencias.push({movimientoId:String(m._id),hash:evento.hashActual,secuencia:evento.secuencia});
  reclasificados++;
 }
 if(p.origenCuentaPorCobrar!==origenNuevo){
  p.origenCuentaPorCobrar=origenNuevo;
 }
 return {reclasificados,ingresoTrabajoMinor:origenNuevo==="TRABAJO"?total:0,saldoPendienteMinor:p.saldoMinor};
}
// El llamador conserva la propiedad de la transacción que también modifica el préstamo.
async function reclasificarOrigenEnSesion(usuarioId,p,origenNuevo,session){
 if(!session?.inTransaction()||!["TRABAJO","PRESTAMO"].includes(origenNuevo))throw problema("Reclasificación no permitida");
 await serializarEscrituraFuente(usuarioId,session);
 verificarCuenta(p,usuarioId);
 return aplicar(usuarioId,p,cobrosConciliados(p,await movimientosVigentes(usuarioId,session)),session,origenNuevo);
}
async function enTransaccion(usuarioId,operacion){
 if(!mongoose.isObjectIdOrHexString(usuarioId))throw problema("Usuario inválido",400);
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   return operacion(session);
  },config);
 }catch(e){
  if(e.code===11000)throw Object.assign(problema("Reparación concurrente; consulta el recibo antes de reintentar"),{code:11000});
  throw e;
 }finally{await session.endSession();}
}
async function corregirOrigenTrabajo(usuarioId,prestamoId,solicitud){
 usuarioId=String(usuarioId).toLowerCase();prestamoId=String(prestamoId).toLowerCase();
 let aplicado;
 const p=await require("./correccionPrestamoPersonal.service").corregir(usuarioId,prestamoId,{origenCuentaPorCobrar:"TRABAJO",revisarCobrosTrabajo:true,...(solicitud?.versionOrigen!==undefined?{versionOrigen:solicitud.versionOrigen}:{})},solicitud,async(u,p,c,session)=>{
  // La selección individual ya se verificó y serializó en la misma transacción.
  verificarCuenta(p,u);
  aplicado=await aplicar(u,p,cobrosConciliados(p,await movimientosVigentes(u,session)),session);
  return{prestamoId:String(p._id),campos:["origenCuentaPorCobrar"],...aplicado};
 });
 const realizada=p.correccion.duplicado?null:aplicado;
 return{reclasificados:realizada?.reclasificados??0,ingresoTrabajoMinor:realizada?.ingresoTrabajoMinor??null,saldoPendienteMinor:p.saldoMinor,prestamoId:String(p._id),correccion:p.correccion};
}
// Huella de selección, no firma ni recibo: se vuelve a calcular dentro del snapshot.
const {canonSeleccion,versionSeleccion}=require("./seleccionRevisionTrabajoPersonal.service");
async function prepararSeleccion(usuarioId,session){
 const trabajos=await Prestamo.collection.find({usuarioId:new mongoose.Types.ObjectId(String(usuarioId)),direccion:"POR_COBRAR",saldoMinor:0,estado:{$ne:"CANCELADO"}},{session,maxTimeMS:5000}).sort({_id:1}).limit(501).toArray();
 if(trabajos.length>500)throw problema("Demasiadas cuentas para una reparación verificable",422);
 const movimientos=trabajos.length?await movimientosVigentes(usuarioId,session):[],planes=[],huellas=[];
 for(const raw of trabajos){
  const vinculados=movimientos.filter(m=>String(m.prestamoId)===String(raw._id));
  let estado,evidencia,motivo;
  try{
   verificarCuenta(raw,usuarioId);
   if(raw.origenCuentaPorCobrar!=="TRABAJO")throw problema("Origen no confirmado como trabajo");
   evidencia=await require("./clasificacionCobroPersonal.service").evidenciaEnSesion(usuarioId,raw,session);
   if(evidencia.tipo!=="INGRESO"||!evidencia.confirmacionHash)throw problema("Confirma explícitamente el origen del cobro histórico antes de reclasificar");
   estado=cobrosConciliados(raw,vinculados);
  }catch(e){if(e.statusCode!==409)throw e;motivo=e.message;}
  const reclasificaciones=estado?estado.cobros.filter(m=>m.tipo!=="INGRESO").length:0;
  const resumen={prestamoId:String(raw._id),contraparte:raw.contraparte||"Sin contraparte",concepto:raw.concepto||"Sin concepto",reclasificaciones,
   estado:motivo?"REQUIERE_REVISION":reclasificaciones?"RECLASIFICAR":"SIN_CAMBIOS",...(motivo?{motivo}:{})};
  planes.push({raw,estado,resumen});
  huellas.push({original:raw,movimientos:vinculados,evidencia:evidencia||null,resumen});
 }
 const cuentas=planes.map(p=>p.resumen);
 return{planes,huellas,resumen:{versionSeleccion:versionSeleccion(usuarioId,huellas),cuentasRevisadas:cuentas.length,
  reclasificacionesPropuestas:cuentas.reduce((n,p)=>n+p.reclasificaciones,0),requierenRevisionManual:cuentas.filter(p=>p.estado==="REQUIERE_REVISION").length,cuentas,soloLectura:true}};
}
async function previsualizarIngresosTrabajo(usuarioId){
 return enTransaccion(usuarioId,async session=>(await prepararSeleccion(usuarioId,session)).resumen);
}
async function reconciliarIngresosTrabajo(usuarioId,solicitud,opciones={}){
 const Recibo=require("./reciboRevisionTrabajoPersonal.service");Recibo.validarSolicitud(usuarioId,solicitud);
 await Recibo.exigirIndices();const contexto=Recibo.Aud.resolver(usuarioId,opciones);
 for(let intento=0;intento<3;intento++)try{return await enTransaccion(usuarioId,async session=>{
  const previo=await Recibo.buscar(usuarioId,solicitud.solicitudId,session);
  if(previo){await Recibo.verificarFuentes(previo,session);if(previo.versionSeleccion!==solicitud.versionSeleccion)throw problema("La clave pertenece a otra selección");return Recibo.salida(previo,true);}
  const {planes,huellas,resumen}=await prepararSeleccion(usuarioId,session),vigente=resumen.versionSeleccion===solicitud.versionSeleccion;
  let corregidos=0,serializada=false;const compensaciones=[];
  if(vigente)for(const {raw,estado,resumen:cuenta} of planes){
   if(cuenta.estado!=="RECLASIFICAR")continue;
   if(!serializada){await serializarEscrituraFuente(usuarioId,session);serializada=true;}
   corregidos+=(await aplicar(usuarioId,raw,estado,session,"TRABAJO",compensaciones)).reclasificados;
  }
  if(vigente&&corregidos!==resumen.reclasificacionesPropuestas)throw problema("La revisión no coincide con la selección confirmada");
  const resultado={corregidos,requierenRevisionManual:vigente?resumen.requierenRevisionManual:null,versionSeleccion:solicitud.versionSeleccion,
   estado:!vigente?"NO_APLICADA":corregidos>0?"CORREGIDO":resumen.requierenRevisionManual>0?"REQUIERE_REVISION":"SIN_CAMBIOS"};
  const recibo=await Recibo.crear({usuarioId,solicitud,huellas,versionObservada:resumen.versionSeleccion,resultado,compensaciones,auditoriaContexto:contexto()},session);
  return Recibo.salida(recibo,false);
 });}catch(e){if(e.code!==11000||intento===2)throw e;}
}
module.exports={corregirOrigenTrabajo,reconciliarIngresosTrabajo,reclasificarOrigenEnSesion,previsualizarIngresosTrabajo,versionSeleccion};
