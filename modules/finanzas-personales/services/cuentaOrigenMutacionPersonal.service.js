"use strict";
const mongoose=require("mongoose");
// Correcciones legadas: una etiqueta de cuenta NO es identidad bancaria.
// Rechazar asientos históricos sin vínculo verificable y moneda COP.
function filtroCuentaOrigenMutacion(asiento,usuarioId){
 if(!asiento||!mongoose.isValidObjectId(asiento.cuentaId)||
    asiento.moneda!=="COP"||
    typeof asiento.cuenta!=="string"||!asiento.cuenta.trim()||
    !mongoose.isValidObjectId(usuarioId))
  throw Object.assign(new Error(
   "Cuenta original no vinculada o moneda incompatible; requiere conciliación antes de modificar caja"
  ),{statusCode:409});
 return {_id:asiento.cuentaId,usuarioId,nombre:asiento.cuenta,
  activa:true,moneda:"COP"};
}
module.exports={filtroCuentaOrigenMutacion};
