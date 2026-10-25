"use strict";
const {canon,eventoCompensatorio,originalVerificado}=require("./eventoCompensatorioPersonal.service");
function invalido(){throw new Error("INTEGRIDAD_LEDGER: historial o identidad contradictorios");}
function vigente(original,eventos=[]){
 if(!Array.isArray(eventos))invalido();
 let actual;
 try{actual=originalVerificado(original);if(canon(actual)!==canon(original))invalido();}
 catch(_){invalido();}
 let anulado=false,ultimaSecuencia=0;
 const claves=new Set();
 for(const e of eventos){
  if(!e||!Number.isSafeInteger(e.secuencia)||e.secuencia<=ultimaSecuencia||
   e.usuarioId!==actual.usuarioId||e.movimientoId!==actual.movimientoId||
   claves.has(e.idempotencyKey)||anulado)invalido();
  let esperado;
  try{
   if(canon(e.original)!==canon(actual))invalido();
   esperado=eventoCompensatorio({
    original:actual,tipo:e.tipo,cambios:e.cambios,idempotencyKey:e.idempotencyKey,
    prevHash:e.prevHash,secuencia:e.secuencia,fechaISO:e.fechaISO
   });
   const campos=Object.keys(esperado);
   // Mongoose agrega únicamente _id en documentos guardados. Ningún metadato
   // adicional puede quedar sin firmar dentro de la proyección financiera.
   if(Object.keys(e).some(k=>k!=="_id"&&!campos.includes(k))||
      campos.some(k=>!Object.prototype.hasOwnProperty.call(e,k))||
      canon(esperado)!==canon(Object.fromEntries(campos.map(k=>[k,e[k]]))))invalido();
  }catch(_){invalido();}
  claves.add(e.idempotencyKey);
  ultimaSecuencia=e.secuencia;
  if(e.tipo==="ANULACION"){anulado=true;continue;}
  actual=Object.freeze({...actual,...e.cambios});
 }
 return Object.freeze({actual:Object.freeze({...actual}),anulado,ultimaSecuencia});
}
module.exports={vigente};
