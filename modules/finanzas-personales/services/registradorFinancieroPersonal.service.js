"use strict";
const {crearRegistrador}=require("./registradorCompensacionPersonal.service");
const {crearAplicadorAtomicoPersonal}=require("./aplicarCompensacionCajaAtomica.service");
// Única fábrica permitida para registrar compensaciones con efecto financiero.
// El registrador de bajo nivel admite modo sin aplicador solo para verificación
// interna y pruebas; ninguna ruta pública debe construirlo directamente.
function crearRegistradorFinancieroPersonal({
 crearAplicador=crearAplicadorAtomicoPersonal,
 ...opciones
}={}){
 if(Object.prototype.hasOwnProperty.call(opciones,"aplicarAtomico")||
    Object.prototype.hasOwnProperty.call(opciones,"exigirAplicacionAtomica")||
    typeof crearAplicador!=="function")
  throw new TypeError("Política de aplicación financiera no modificable");
 const aplicarAtomico=crearAplicador();
 if(typeof aplicarAtomico!=="function")
  throw Object.assign(new Error("APLICADOR_ATOMICO_REQUERIDO"),{statusCode:503});
 return crearRegistrador({...opciones,aplicarAtomico,exigirAplicacionAtomica:true});
}
module.exports={crearRegistradorFinancieroPersonal};
