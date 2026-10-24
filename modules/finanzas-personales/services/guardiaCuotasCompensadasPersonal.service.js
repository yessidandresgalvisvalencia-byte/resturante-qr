"use strict";
// Barrera de integridad: una corrección o anulación de pago recurrente
// necesita reconciliar también la reserva por período. No calcular
// "pendiente" desde el asiento original si su valor vigente es distinto.
const {verificarCadena,originalVerificado,canon}=
 require("./eventoCompensatorioPersonal.service");
const {comprobarHistorialCompensatorio}=
 require("./comprobarHistorialCompensatorio.service");
const GENESIS="0".repeat(64);
function error(m){throw Object.assign(new Error("CUOTA_COMPENSADA_NO_CONCILIADA: "+m),{statusCode:409});}
function comprobarPagosSinCompensacionesPendientes({
 usuarioId,origen,pagos,eventos,cursor
}){
 if(typeof usuarioId!=="string"||!usuarioId||!origen||!origen._id||
  !Array.isArray(pagos)||!Array.isArray(eventos))
  error("argumentos incompletos");
 if(!verificarCadena(eventos,{prevHash:GENESIS}))
  error("cadena compensatoria inválida");
 if(cursor){
  if(!Number.isSafeInteger(cursor.secuencia)||
   cursor.secuencia!==eventos.length||
   cursor.hashActual!==(eventos.length?eventos.at(-1).hashActual:GENESIS))
   error("cursor y cadena incompatibles");
 }else if(eventos.length)error("eventos sin cursor");
 const estados=comprobarHistorialCompensatorio(eventos,{usuarioId});
 const pagosPorId=new Map();
 for(const p of pagos){
  const id=String(p?._id||"");
  if(!p||!id||pagosPorId.has(id)||String(p.usuarioId)!==usuarioId||
   String(p.recurrenteOrigenId)!==String(origen._id))
   error("abono duplicado, ajeno o mal vinculado");
  pagosPorId.set(id,p);
 }
 // Comprobar todos los eventos, no solamente el último, y prohibir
 // compensaciones sobre pagos fuera de la lista presentada. De otro modo
 // se podría excluir una anulación y contar indebidamente la cuota.
 for(const e of eventos){
  if(e.usuarioId!==usuarioId)error("evento ajeno");
  const pago=pagosPorId.get(String(e.movimientoId));
  if(!pago)continue; // La misma cadena contiene otros movimientos ajenos a esta cuota.
  let original;
  try{
   original=originalVerificado({usuarioId,movimientoId:String(pago._id),
    tipo:pago.tipo,montoMinor:pago.montoMinor,
    concepto:pago.concepto,categoria:pago.categoria});
  }catch(_){error("asiento de abono inválido");}
  const primera=eventos.find(x=>x.movimientoId===String(pago._id));
  if(!primera||canon(primera.original)!==canon(original)||
   pago.estado!=="ACTIVA"||pago.impactoCaja===false)
   error("original compensado inconsistente");
 }
 for(const id of estados.keys()){
  if(pagosPorId.has(id)){
   // Incluso las correcciones de texto quedan bloqueadas hasta
   // conciliar su aplicación y el cerrojo recurrente con el ledger.
   error("existe compensación de abono; conciliar reserva primero");
  }
 }
 return true;
}
module.exports={comprobarPagosSinCompensacionesPendientes};
