"use strict";
const {conciliarCuentaAisladaV81}=require("./conciliacionCuentaAisladaV81.service");
// Una conciliación con movimientos históricos exige período y ancla explícitos.
// Los eventos fuera del período invalidan la entrada en vez de contaminar el resultado.
function conciliarPeriodoCuentaV81({desde,hastaExclusivo,movimientos,...resto}={}){
 if(typeof desde!=="string"||typeof hastaExclusivo!=="string"||
    !/^\d{4}-\d{2}-\d{2}$/.test(desde)||!/^\d{4}-\d{2}-\d{2}$/.test(hastaExclusivo)||
    !Number.isFinite(Date.parse(desde+"T00:00:00Z"))||
    !Number.isFinite(Date.parse(hastaExclusivo+"T00:00:00Z"))||
    new Date(desde+"T00:00:00Z").toISOString().slice(0,10)!==desde||
    new Date(hastaExclusivo+"T00:00:00Z").toISOString().slice(0,10)!==hastaExclusivo||
    desde>=hastaExclusivo||!Array.isArray(movimientos))
  throw new TypeError("Período de conciliación inválido");
 for(const movimiento of movimientos){
  if(typeof movimiento?.fechaContable!=="string"||movimiento.fechaContable<desde||
     movimiento.fechaContable>=hastaExclusivo)
   throw new Error("Movimiento fuera del período o sin fecha contable");
 }
 return Object.freeze({...conciliarCuentaAisladaV81({...resto,movimientos}),desde,hastaExclusivo});
}
module.exports={conciliarPeriodoCuentaV81};
