"use strict";
// Replica únicamente la semántica del agregado histórico de flujoPeriodo.
// No es un segundo libro contable ni una fuente autorizada de caja.
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fallo(mensaje){throw Object.assign(new Error("INTEGRIDAD_DIAGNOSTICO: "+mensaje),{statusCode:409});}
function numero(n){if(typeof n!=="bigint"||n>MAX||n< -MAX)fallo("total fuera de rango seguro");return Number(n);}
function compararProyeccionesPersonal({usuarioId,movimientos,desde,hasta,verificado}){
 if(!usuarioId||!Array.isArray(movimientos)||!verificado||
    verificado.fuente!=="EVENTOS_COMPENSATORIOS_VERIFICADOS")
  fallo("entradas no verificadas");
 const inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||inicio>=fin)
  fallo("período inválido");
 let ingresos=0n,gastos=0n,deuda=0n,obligacionesNoCaja=0;
 for(const m of movimientos){
  if(String(m.usuarioId)!==String(usuarioId))fallo("identidad incompatible");
  if(!Number.isSafeInteger(m.montoMinor)||m.montoMinor<=0)
   fallo("importe inválido");
  const fecha=new Date(m.fecha);
  if(!Number.isFinite(fecha.getTime()))fallo("fecha inválida");
  if(fecha<inicio||fecha>=fin||m.estado==="ANULADA"||m.moneda!=="COP")continue;
  const n=BigInt(m.montoMinor);
  // Representa EXACTAMENTE el agregado legacy, incluidos compromisos aún no pagados.
  if(["INGRESO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(m.tipo))ingresos+=n;
  else if(["GASTO","PRESTAMO_OTORGADO"].includes(m.tipo))gastos+=n;
  else if(m.tipo==="PAGO_DEUDA")deuda+=n;
  if(m.impactoCaja===false&&m.tipo!=="AJUSTE_SALDO")obligacionesNoCaja++;
 }
 const legado={
  ingresosMinor:numero(ingresos),gastosMinor:numero(gastos),
  pagosDeudaMinor:numero(deuda),flujoNetoMinor:numero(ingresos-gastos-deuda)
 };
 const diferencia={
  ingresosMinor:numero(BigInt(verificado.ingresosMinor)-ingresos),
  gastosMinor:numero(BigInt(verificado.gastosMinor)-gastos),
  pagosDeudaMinor:numero(BigInt(verificado.pagosDeudaMinor)-deuda),
  flujoNetoMinor:numero(BigInt(verificado.flujoNetoMinor)-(ingresos-gastos-deuda))
 };
 return Object.freeze({
  coincide:Object.values(diferencia).every(n=>n===0),
  legado:Object.freeze(legado),
  verificado,
  diferenciaVerificadoMenosLegado:Object.freeze(diferencia),
  obligacionesNoCajaIncluidasPorLegado:obligacionesNoCaja,
  estado:"DIAGNOSTICO_NO_APTO_COMO_SALDO_BANCARIO"
 });
}
module.exports={compararProyeccionesPersonal};
