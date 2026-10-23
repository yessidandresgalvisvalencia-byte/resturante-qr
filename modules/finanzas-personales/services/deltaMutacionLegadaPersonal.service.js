"use strict";
// Calcula deltas contables exactos antes de ejecutar $inc en MongoDB.
// Restar dos importes safe puede producir un delta NO safe.
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function error(mensaje){throw Object.assign(new Error("DELTA_LEGADO_INVALIDO: "+mensaje),{statusCode:409});}
function importe(n){
 if(!Number.isSafeInteger(n)||n<=0)error("importe debe ser entero positivo seguro");
 return BigInt(n);
}
function signo(tipo){
 if(tipo==="INGRESO")return 1n;
 if(tipo==="GASTO")return -1n;
 error("tipo no admitido para mutación heredada");
}
function deltaCorreccionLegada({tipoAnterior,montoAnteriorMinor,tipoNuevo,montoNuevoMinor}){
 const inicial=signo(tipoAnterior)*importe(montoAnteriorMinor);
 const final=signo(tipoNuevo)*importe(montoNuevoMinor);
 const delta=final-inicial;
 if(delta>MAX||delta< -MAX)error("delta fuera del rango seguro");
 return Number(delta);
}
function deltaAnulacionLegada({tipo,montoMinor}){
 const delta= -signo(tipo)*importe(montoMinor);
 if(delta>MAX||delta< -MAX)error("reverso fuera del rango seguro");
 return Number(delta);
}
module.exports={deltaCorreccionLegada,deltaAnulacionLegada};
