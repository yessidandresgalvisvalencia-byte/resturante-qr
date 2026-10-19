"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Vinculo=require("../models/vinculoHistoricoV81.model");
const {conciliarPeriodoCuentaV81}=require("./conciliacionPeriodoCuentaV81.service");
const {exigirSinMovimientosHuerfanos}=require("./guardiaConciliacionCuentaV81.service");
const MAX_FILAS_CONCILIACION_V81=25000;
const MAX_TIEMPO_CONSULTA_MONGO_V81_MS=15000;
const MAX_DIAS_CONCILIACION_V81=366;
function exigirPeriodoAcotadoV81(desde,hastaExclusivo){
 if(!fechaCalendarioValidaV81(desde)||!fechaCalendarioValidaV81(hastaExclusivo))
  throw new TypeError("Período inválido");
 const inicio=new Date(desde+"T00:00:00Z");
 const fin=new Date(hastaExclusivo+"T00:00:00Z");
 const dias=(fin.getTime()-inicio.getTime())/86400000;
 if(!Number.isSafeInteger(dias)||dias<1||dias>MAX_DIAS_CONCILIACION_V81)
  throw new TypeError("Período de conciliación fuera del límite de 366 días");
 return true;
}

const FORMATEADOR_FECHA_BOGOTA_V81=new Intl.DateTimeFormat("en-US",{
 timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"
});
function fechaContableBogotaV81(fecha){
 if(!(fecha instanceof Date)||!Number.isFinite(fecha.getTime()))
  throw new TypeError("Fecha del movimiento inválida");
 const piezas=FORMATEADOR_FECHA_BOGOTA_V81.formatToParts(fecha);
 const partes=Object.fromEntries(piezas.map(x=>[x.type,x.value]));
 return `${partes.year}-${partes.month}-${partes.day}`;
}

function exigirResultadosAcotadosV81(filas){
 if(!Array.isArray(filas))throw new TypeError("Consulta histórica inválida");
 if(filas.length>MAX_FILAS_CONCILIACION_V81){
  const error=new Error("Límite de consulta histórica excedido: dividir el período y revisar los vínculos");
  error.statusCode=409;
  throw error;
 }
 return filas;
}
function exigirMovimientosUnicosV81(filas){
 if(!Array.isArray(filas))throw new TypeError("Histórico de conciliación inválido");
 const vistos=new Set();
 for(const fila of filas){
  const id=fila?._id;
  if(!id||!mongoose.isValidObjectId(id)||vistos.has(String(id))){
   const error=new Error("Histórico inconsistente: movimiento duplicado o sin identidad");
   error.statusCode=409;
   throw error;
  }
  vistos.add(String(id));
 }
 return filas;
}
function crearPipelineVinculosPeriodoV81({usuarioId,cuentaId,desde,hasta}) {
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(cuentaId)||
    !(desde instanceof Date)||Number.isNaN(desde.getTime())||
    !(hasta instanceof Date)||Number.isNaN(hasta.getTime())||desde>=hasta)
  throw new TypeError("Período o identidad de conciliación inválidos");
 const usuario=new mongoose.Types.ObjectId(usuarioId);
 const cuenta=new mongoose.Types.ObjectId(cuentaId);
 return [
  {$match:{usuarioId:usuario,cuentaId:cuenta}},
  {$lookup:{from:Transaccion.collection.name,localField:"movimientoId",foreignField:"_id",as:"movimiento"}},
  {$unwind:"$movimiento"},
  {$match:{"movimiento.usuarioId":usuario,"movimiento.cuentaId":null,
   "movimiento.moneda":"COP","movimiento.estado":{$ne:"ANULADA"},
   "movimiento.fecha":{$gte:desde,$lt:hasta}}},
  {$replaceRoot:{newRoot:"$movimiento"}},
  {$limit:MAX_FILAS_CONCILIACION_V81+1}
 ];
}
function filtrarHuerfanosSinResolver(filas,vinculos){
 if(!Array.isArray(filas)||!Array.isArray(vinculos))throw new TypeError("Histórico inválido");
 // Una asociación incompleta no resuelve el movimiento. Más de un vínculo
 // para el mismo asiento es una anomalía de integridad, aunque apunten a la
 // misma cuenta: fallar cerrado antes de dar por conciliado el histórico.
 const resueltos=new Set();
 const vistos=new Set();
 for(const vinculo of vinculos){
  if(!vinculo?.movimientoId||!mongoose.isValidObjectId(vinculo.movimientoId))continue;
  const id=String(vinculo.movimientoId);
  if(vistos.has(id)){
   throw Object.assign(new Error("Vínculos históricos duplicados o contradictorios; requiere conciliación manual"),{statusCode:409});
  }
  vistos.add(id);
  if(vinculo.cuentaId!=null&&mongoose.isValidObjectId(vinculo.cuentaId))resueltos.add(id);
 }
 return filas.filter(f=>!resueltos.has(String(f._id)));
}
function fechaCalendarioValidaV81(fecha){
 if(typeof fecha!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha))return false;
 const d=new Date(fecha+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===fecha;
}
// Reporte de conciliación SOLO LECTURA sobre una instantánea del histórico.
// Requiere anclas explícitas: el saldo de cuenta no se deduce del flujo.
async function conciliarHistoricoCuentaV81({usuarioId,cuentaId,desde,hastaExclusivo,saldoInicialCentavos,saldoObservadoCentavos}){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(cuentaId))throw new TypeError("Cuenta o usuario inválido");
 exigirPeriodoAcotadoV81(desde,hastaExclusivo);
 // No abrir transacción ni consultar datos si las anclas carecen de precisión exacta.
 // Los saldos negativos se permiten por sobregiro; los Number no son moneda válida.
 if(typeof saldoInicialCentavos!=="bigint"||typeof saldoObservadoCentavos!=="bigint")
  throw new TypeError("Saldos de conciliación obligatorios en BigInt");
 const start=new Date(desde+"T05:00:00Z"),end=new Date(hastaExclusivo+"T05:00:00Z");
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw new TypeError("Período inválido");
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const cuenta=await Cuenta.findOne({_id:new mongoose.Types.ObjectId(cuentaId),usuarioId:new mongoose.Types.ObjectId(usuarioId),activa:true,moneda:"COP"}).session(session).maxTimeMS(MAX_TIEMPO_CONSULTA_MONGO_V81_MS).lean();
   if(!cuenta)throw Object.assign(new Error("Cuenta no autorizada o inexistente"),{statusCode:404});
   const rows=await Transaccion.find({usuarioId:new mongoose.Types.ObjectId(usuarioId),cuentaId:new mongoose.Types.ObjectId(cuentaId),moneda:"COP",estado:{$ne:"ANULADA"},fecha:{$gte:start,$lt:end}})
    .session(session).sort({_id:1}).limit(MAX_FILAS_CONCILIACION_V81+1).maxTimeMS(MAX_TIEMPO_CONSULTA_MONGO_V81_MS).lean();
   exigirResultadosAcotadosV81(rows);
   // Filtrar por fecha antes de limitar: un usuario puede tener más de
   // 25.000 vínculos históricos de otros meses sin afectar este período.
   // El JOIN utiliza la clave primaria del movimiento y exige mismo usuario.
   const heredados=await Vinculo.aggregate(crearPipelineVinculosPeriodoV81({
    usuarioId,cuentaId,desde:start,hasta:end
   })).session(session).option({maxTimeMS:MAX_TIEMPO_CONSULTA_MONGO_V81_MS}).exec();
   exigirResultadosAcotadosV81(heredados);
   const sinVinculo=await Transaccion.find({
    usuarioId:new mongoose.Types.ObjectId(usuarioId),cuentaId:null,
    cuenta:cuenta.nombre,moneda:"COP",estado:{$ne:"ANULADA"},
    fecha:{$gte:start,$lt:end}
   }).session(session).select("_id cuenta cuentaId").limit(MAX_FILAS_CONCILIACION_V81+1).maxTimeMS(MAX_TIEMPO_CONSULTA_MONGO_V81_MS).lean();
   exigirResultadosAcotadosV81(sinVinculo);
   // Una confirmación puede haber asociado el huérfano a otra cuenta.
   // En ese caso tampoco debe bloquear falsamente esta conciliación.
   const resueltos=sinVinculo.length?await Vinculo.find({
    usuarioId:new mongoose.Types.ObjectId(usuarioId),
    movimientoId:{$in:sinVinculo.map(x=>x._id)}
   }).session(session).select("movimientoId cuentaId").limit(MAX_FILAS_CONCILIACION_V81+1).maxTimeMS(MAX_TIEMPO_CONSULTA_MONGO_V81_MS).lean():[];
   exigirResultadosAcotadosV81(resueltos);
   const sinResolver=filtrarHuerfanosSinResolver(sinVinculo,resueltos);
   exigirSinMovimientosHuerfanos({cuenta,filas:sinResolver});
   const filasConciliables=exigirMovimientosUnicosV81(exigirResultadosAcotadosV81([...rows,...heredados]));
   const movimientos=filasConciliables.map(row=>{
    if(!Number.isSafeInteger(row.montoMinor)||row.montoMinor<=0||row.impactoCaja!==true||
       !["INGRESO","GASTO"].includes(row.tipo)||row.medioPago==="CREDITO")
      throw new Error("Movimiento histórico no clasificable: conciliación bloqueada");
    const fechaContable=fechaContableBogotaV81(row.fecha);
    return {id:String(row._id),usuarioId:String(usuarioId),cuentaId:String(cuentaId),fechaContable,
      tipo:row.tipo==="INGRESO"?"ENTRADA":"SALIDA",montoCentavos:BigInt(row.montoMinor)*100n};
   });
   const resultado=conciliarPeriodoCuentaV81({usuarioId:String(usuarioId),cuentaId:String(cuentaId),desde,hastaExclusivo,
    saldoInicialCentavos,saldoObservadoCentavos,movimientos,cantidadEsperadaMovimientos:filasConciliables.length});
   return Object.freeze({...resultado,origenSaldos:"REFERENCIAS_APORTADAS",saldoBancarioVerificado:false,
    advertencia:"COINCIDENCIA_ARITMETICA_NO_ACREDITA_SALDO_BANCARIO"});
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
}
module.exports={exigirMovimientosUnicosV81,conciliarHistoricoCuentaV81,filtrarHuerfanosSinResolver,fechaCalendarioValidaV81,exigirResultadosAcotadosV81,MAX_FILAS_CONCILIACION_V81,MAX_TIEMPO_CONSULTA_MONGO_V81_MS,MAX_DIAS_CONCILIACION_V81,exigirPeriodoAcotadoV81,crearPipelineVinculosPeriodoV81,fechaContableBogotaV81};
