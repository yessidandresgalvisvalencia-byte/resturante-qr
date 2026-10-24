"use strict";
const {comprobarPagosSinCompensacionesPendientes}=
 require("./guardiaCuotasCompensadasPersonal.service");
const {conciliarCuotasPrevistas}=
 require("./conciliarCuotasPrevistasPersonal.service");
// Se usa cuando el llamador obtuvo TODO el historial relevante, los eventos
// y el cursor en un único snapshot Mongo. Sin esta garantía no habilitar HTTP.
function conciliarCuotasConCadenaVerificada({
 usuarioId,origen,pagos,eventos,cursor,desde,hasta
}){
 comprobarPagosSinCompensacionesPendientes({
  usuarioId,origen,pagos,eventos,cursor
 });
 const resultado=conciliarCuotasPrevistas({
  usuarioId,origen,pagos,desde,hasta
 });
 return {...resultado,fuenteCompensacion:"CADENA_VERIFICADA_SIN_EVENTOS_SOBRE_ABONOS",
  aptoParaDisponibleHoy:false};
}
module.exports={conciliarCuotasConCadenaVerificada};
