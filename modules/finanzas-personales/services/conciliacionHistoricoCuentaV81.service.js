"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const {conciliarPeriodoCuentaV81}=require("./conciliacionPeriodoCuentaV81.service");
// Reporte de conciliación SOLO LECTURA sobre una instantánea del histórico.
// Requiere anclas explícitas: el saldo de cuenta no se deduce del flujo.
async function conciliarHistoricoCuentaV81({usuarioId,cuentaId,desde,hastaExclusivo,saldoInicialCentavos,saldoObservadoCentavos}){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(cuentaId))throw new TypeError("Cuenta o usuario inválido");
 if(typeof desde!=="string"||typeof hastaExclusivo!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(desde)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(hastaExclusivo))throw new TypeError("Período inválido");
 const start=new Date(desde+"T05:00:00Z"),end=new Date(hastaExclusivo+"T05:00:00Z");
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw new TypeError("Período inválido");
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const rows=await Transaccion.find({usuarioId:new mongoose.Types.ObjectId(usuarioId),cuentaId:new mongoose.Types.ObjectId(cuentaId),moneda:"COP",estado:{$ne:"ANULADA"},fecha:{$gte:start,$lt:end}})
    .session(session).sort({_id:1}).lean();
   const movimientos=rows.map(row=>{
    if(!Number.isSafeInteger(row.montoMinor)||row.montoMinor<=0||row.impactoCaja!==true||
       !["INGRESO","GASTO"].includes(row.tipo)||row.medioPago==="CREDITO")
      throw new Error("Movimiento histórico no clasificable: conciliación bloqueada");
    const piezas=new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(row.fecha);
    const partes=Object.fromEntries(piezas.map(x=>[x.type,x.value]));
    const fechaContable=`${partes.year}-${partes.month}-${partes.day}`;
    return {id:String(row._id),usuarioId:String(usuarioId),cuentaId:String(cuentaId),fechaContable,
      tipo:row.tipo==="INGRESO"?"ENTRADA":"SALIDA",montoCentavos:BigInt(row.montoMinor)*100n};
   });
   return conciliarPeriodoCuentaV81({usuarioId:String(usuarioId),cuentaId:String(cuentaId),desde,hastaExclusivo,
    saldoInicialCentavos,saldoObservadoCentavos,movimientos,cantidadEsperadaMovimientos:rows.length});
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
}
module.exports={conciliarHistoricoCuentaV81};
