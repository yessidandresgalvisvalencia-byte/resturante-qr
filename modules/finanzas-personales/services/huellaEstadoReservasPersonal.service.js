"use strict";
const {createHash,timingSafeEqual}=require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
function fallo(m,statusCode=409){
 throw Object.assign(new Error("ESTADO_RESERVAS: "+m),{statusCode});
}
function oid(x){const s=String(x??"");if(!/^[a-f0-9]{24}$/i.test(s))fallo("identificador inválido");return s.toLowerCase();}
function entero(x,{positivo=false}={}){
 if(!Number.isSafeInteger(x)||(positivo?x<=0:x<0))fallo("importe fuera de rango");
 return String(x);
}
function fecha(x){
 if(!(x instanceof Date)||!Number.isFinite(x.getTime()))fallo("fecha inválida");
 return x.toISOString();
}
function ordenarUnico(items,campo){
 const orden=items.sort((a,b)=>a[campo].localeCompare(b[campo]));
 for(let i=1;i<orden.length;i++)
  if(orden[i-1][campo]===orden[i][campo])fallo("duplicados en estado");
 return orden;
}
// Incluye todos los datos materiales de la reserva y los abonos,
// incluidos ANULADA, para que un cambio de historial NO conserve la
// misma huella aunque el delta propuesto permanezca idéntico.
function huellaEstadoReservas({usuarioId,origen,pagos,reservas,eventos,cursor,cancelacion=null}){
 const uid=oid(usuarioId),id=oid(origen?._id);
 if(oid(origen.usuarioId)!==uid||!Array.isArray(pagos)||
    !Array.isArray(reservas)||!Array.isArray(eventos)||
    pagos.length>10000||reservas.length>10000||eventos.length>10000)
  fallo("historial incompleto o identidad inconsistente");
 const base={
  id,usuarioId:uid,tipo:origen.tipo,estado:origen.estado,
  montoMinor:entero(origen.montoMinor,{positivo:true}),
  fecha:fecha(origen.fecha),frecuencia:origen.frecuencia,
  recurrente:origen.recurrente,impactoCaja:origen.impactoCaja,
  cuenta:origen.cuenta,cuentaId:origen.cuentaId===null?null:oid(origen.cuentaId)
 };
 const abonos=ordenarUnico(pagos.map(p=>{
  if(oid(p.usuarioId)!==uid||oid(p.recurrenteOrigenId)!==id)
   fallo("abono ajeno");
  return {id:oid(p._id),estado:p.estado,tipo:p.tipo,
   impactoCaja:p.impactoCaja,montoMinor:entero(p.montoMinor,{positivo:true}),
   fecha:fecha(p.fecha),cuentaId:p.cuentaId?oid(p.cuentaId):null,
   concepto:p.concepto??null,categoria:p.categoria??null};
 }),"id");
 const cierres=ordenarUnico(reservas.map(r=>{
  if(oid(r.usuarioId)!==uid||oid(r.origenId)!==id)
   fallo("reserva ajena");
  return {id:oid(r._id),inicio:fecha(r.periodoInicio),
   fin:fecha(r.periodoFin),reservadoMinor:entero(r.reservadoMinor),
   importeCuotaMinor:entero(r.importeCuotaMinor,{positivo:true})};
 }),"inicio");
 let ultimo=0,hash="0".repeat(64);
 for(const e of eventos){
  if(String(e.usuarioId)!==uid||!Number.isSafeInteger(e.secuencia)||
     e.secuencia!==ultimo+1||!HEX.test(e.hashActual)||
     e.prevHash!==hash)fallo("secuencia compensatoria inconsistente");
  ultimo=e.secuencia;hash=e.hashActual;
 }
 if(cursor){
  if(cursor.secuencia!==ultimo||cursor.hashActual!==hash)
   fallo("cursor desincronizado");
 }else if(ultimo!==0)fallo("eventos sin cursor");
 if(cancelacion!==null)fallo("obligación cancelada");
 const payload={version:1,usuarioId:uid,origen:base,pagos:abonos,
  reservas:cierres,cursor:{secuencia:ultimo,hashActual:hash}};
 return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function verificarHuellaEstado(actual,esperada){
 if(typeof esperada!=="string"||!HEX.test(esperada))
  fallo("huella de estado inválida",400);
 if(!timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(esperada,"hex")))
  fallo("estado financiero modificado: nueva lectura requerida");
 return true;
}
module.exports={huellaEstadoReservas,verificarHuellaEstado};
