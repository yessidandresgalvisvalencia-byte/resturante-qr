"use strict";
const {verificarCadena,originalVerificado,canon}=require("./eventoCompensatorioPersonal.service");
const {comprobarHistorialCompensatorio}=require("./comprobarHistorialCompensatorio.service");
const GENESIS="0".repeat(64);
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function integridad(mensaje){throw Object.assign(new Error("INTEGRIDAD_LEDGER: "+mensaje),{statusCode:409});}
function entero(n){if(!Number.isSafeInteger(n))integridad("importe fuera de rango seguro");return BigInt(n);}
function flujoCompensadoPuro({usuarioId,movimientos,eventos=[],desde,hasta}){
 if(typeof usuarioId!=="string"||!usuarioId||!Array.isArray(movimientos)||
    !Array.isArray(eventos))integridad("argumentos inválidos");
 const inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||inicio>=fin)
  throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
 if(!verificarCadena(eventos,{prevHash:GENESIS}))integridad("cadena inválida");
 const estados=comprobarHistorialCompensatorio(eventos,{usuarioId});
 const vistos=new Set();
 const primeros=new Map();
 for(const e of eventos)if(!primeros.has(e.movimientoId))primeros.set(e.movimientoId,e);
 const acumulado={INGRESO:0n,GASTO:0n,PRESTAMO_RECIBIDO:0n,COBRO_PRESTAMO:0n,PRESTAMO_OTORGADO:0n,PAGO_DEUDA:0n};
 for(const m of movimientos){
  if(!m||String(m.usuarioId)!==usuarioId)integridad("movimiento ajeno");
  const id=String(m._id??m.movimientoId??"");
  if(!id||vistos.has(id))integridad("ID de movimiento duplicado");
  vistos.add(id);
  if(!["ACTIVA","ANULADA"].includes(m.estado))integridad("estado de movimiento inválido");
  // Comprobar TODO asiento, incluso anulado o fuera del período: un filtro
  // temporal o una anulación jamás deben ocultar datos históricos inválidos.
  if(!Number.isSafeInteger(m.montoMinor)||m.montoMinor<=0)
   integridad("importe histórico inválido");
  if(m.moneda!=="COP")integridad("moneda no autorizada");
  const fecha=new Date(m.fecha);
  if(!Number.isFinite(fecha.getTime()))integridad("fecha inválida");
  if(m.impactoCaja!==undefined&&typeof m.impactoCaja!=="boolean")
   integridad("indicador de impacto de caja inválido");
  const estado=estados.get(id);
  if(estado&&m.impactoCaja===false)
   integridad("compensación sobre asiento sin impacto real de caja");
  if(estado&&m.estado!=="ACTIVA")
   integridad("movimiento original alterado por ruta legada y compensatoria");
  let actual=m;
  if(estado){
   let inicial;
   try{
    inicial=originalVerificado({usuarioId,movimientoId:id,tipo:m.tipo,
     montoMinor:m.montoMinor,concepto:m.concepto,categoria:m.categoria});
   }catch(_){integridad("asiento original inválido");}
   const primero=primeros.get(id);
   if(!primero||canon(inicial)!==canon(primero.original))
    integridad("asiento original y eventos contradictorios");
   if(estado.anulado)continue;
   actual=estado.actual;
  }else if(m.estado==="ANULADA")continue;
  // Una obligación futura todavía no pagada NO reduce la caja realizada.
  // Se conserva en compromisos/proyecciones de vencimientos, no aquí.
  if(m.impactoCaja===false)continue;
  if(fecha<inicio||fecha>=fin)continue;
  // Un ajuste manual de saldo no equivale a ingreso/gasto del período.
  if(actual.tipo==="AJUSTE_SALDO")continue;
  if(Object.prototype.hasOwnProperty.call(acumulado,actual.tipo))
   acumulado[actual.tipo]+=entero(actual.montoMinor);
  else integridad("tipo de movimiento desconocido");
 }
 for(const id of estados.keys())if(!vistos.has(id))integridad("compensación sin asiento original");
 const ingresos=acumulado.INGRESO+acumulado.PRESTAMO_RECIBIDO+acumulado.COBRO_PRESTAMO;
 const gastos=acumulado.GASTO+acumulado.PRESTAMO_OTORGADO;
 const deuda=acumulado.PAGO_DEUDA;
 const neto=ingresos-gastos-deuda;
 for(const n of [ingresos,gastos,deuda,neto])if(n>MAX||n< -MAX)
  integridad("agregado fuera de rango seguro");
 return Object.freeze({ingresosMinor:Number(ingresos),gastosMinor:Number(gastos),
  pagosDeudaMinor:Number(deuda),flujoNetoMinor:Number(neto),moneda:"COP",
  fuente:"EVENTOS_COMPENSATORIOS_VERIFICADOS"});
}
module.exports={flujoCompensadoPuro};
