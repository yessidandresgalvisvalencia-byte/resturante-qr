"use strict";
// Una única política para consulta y escritura de compensaciones ordinarias.
// No hay permiso implícito: una cuenta sin conciliación no es corregible.
function elegibilidadCompensacion({asiento,cuenta,usuarioId}={}){
 if(!asiento||!cuenta||!usuarioId)return false;
 return String(asiento.usuarioId)===String(usuarioId)&&
  String(cuenta.usuarioId)===String(usuarioId)&&
  String(asiento.cuentaId||"")===String(cuenta._id||"")&&
  ["INGRESO","GASTO"].includes(asiento.tipo)&&
  asiento.estado==="ACTIVA"&&asiento.impactoCaja===true&&
  asiento.recurrente!==true&&!asiento.recurrenteOrigenId&&!asiento.prestamoId&&
  cuenta.activa===true&&cuenta.moneda==="COP"&&
  cuenta.requiereReconciliacion===false&&
  Number.isSafeInteger(cuenta.saldoMinor);
}
module.exports={elegibilidadCompensacion};
