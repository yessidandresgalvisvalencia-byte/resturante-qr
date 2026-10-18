"use strict";
// Una cuenta que tiene transacciones sin cuentaId no debe mostrar conciliación
// exitosa basada únicamente en las filas que sí tienen cuentaId.
function exigirSinMovimientosHuerfanos({cuenta,filas}){
 if(!cuenta||typeof cuenta.nombre!=="string"||!Array.isArray(filas))
  throw new TypeError("Entradas de conciliación inválidas");
 const huerfanos=filas.filter(x=>x&&x.cuentaId==null&&x.cuenta===cuenta.nombre);
 if(huerfanos.length){
  const error=new Error("Movimiento histórico no clasificable: hay asientos sin cuentaId; requiere conciliación manual");
  error.statusCode=409;
  throw error;
 }
 return true;
}
module.exports={exigirSinMovimientosHuerfanos};
