"use strict";
const {eventoCompensatorio,hashEvento,sinContexto}=require("./eventoCompensatorioPersonal.service");
const CAMPOS=["usuarioId","movimientoId","tipo","montoMinor","concepto","categoria","impactoCaja","prestamoId","numeroCuota","montoPagadoRealMinor"];
function iguales(a,b){return CAMPOS.every(k=>a[k]===b[k]);}
function vigente(original,eventos=[]){
 if(!original||!Array.isArray(eventos))throw new TypeError("Historial obligatorio");
 let actual={...original},anulado=false,ultimaSecuencia=0,anulacionHash=null;
 for(const e of eventos){
  if(!e||!Number.isSafeInteger(e.secuencia)||e.secuencia<=ultimaSecuencia||
   e.usuarioId!==original.usuarioId||e.movimientoId!==original.movimientoId||
   !iguales(actual,e.original)||anulado&&e.tipo!=="RESTAURACION"||
   e.tipo==="RESTAURACION"&&(!anulado||e.version!==(actual.tipo==="PAGO_DEUDA"?(actual.prestamoId?7:6):5)||e.anulacionHash!==anulacionHash))
   throw new Error("INTEGRIDAD_LEDGER: historial o identidad contradictorios");
  const {hashActual}=e;
  if(typeof hashActual!=="string"||
   hashEvento(e)!==hashActual)
   throw new Error("INTEGRIDAD_LEDGER: firma de evento alterada");
  const esperado=eventoCompensatorio({original:actual,tipo:e.tipo,cambios:e.cambios,
   idempotencyKey:e.idempotencyKey,prevHash:e.prevHash,secuencia:e.secuencia,fechaISO:e.fechaISO,...(e.tipo==="RESTAURACION"?{anulacionHash:e.anulacionHash}:{})});
  if(esperado.hashActual!==hashEvento(sinContexto(e))||esperado.deltaCajaMinor!==e.deltaCajaMinor)
   throw new Error("INTEGRIDAD_LEDGER: delta o contenido inconsistente");
  ultimaSecuencia=e.secuencia;
  if(e.tipo==="ANULACION"){anulado=true;anulacionHash=e.hashActual;continue;}
  if(e.tipo==="RESTAURACION"){anulado=false;anulacionHash=null;continue;}
  actual={...actual,...e.cambios};
 }
 return Object.freeze({actual:Object.freeze(actual),anulado,ultimaSecuencia});
}
module.exports={vigente};
