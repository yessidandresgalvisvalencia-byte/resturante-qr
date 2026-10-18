"use strict";
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
// Informe histórico de solo lectura: flujo registrado, NO saldo bancario ni equivalencia a V81.
async function consultarFlujoHistoricoV81(usuarioId){
 if(!mongoose.isValidObjectId(usuarioId))throw new TypeError("Usuario inválido");
 const rows=await Transaccion.find({usuarioId:new mongoose.Types.ObjectId(usuarioId),moneda:"COP",estado:{$ne:"ANULADA"}})
  .select("tipo montoMinor impactoCaja medioPago").lean();
 let ingresos=0n,gastos=0n,excluidos=0;
 for(const row of rows){
  if(!Number.isSafeInteger(row.montoMinor)||row.montoMinor<=0)throw new Error("Monto histórico inseguro");
  if(row.tipo==="INGRESO"&&row.impactoCaja!==false)ingresos+=BigInt(row.montoMinor);
  else if(row.tipo==="GASTO"&&row.impactoCaja!==false&&row.medioPago!=="CREDITO")gastos+=BigInt(row.montoMinor);
  else excluidos++;
 }
 return Object.freeze({fuente:"fin_transacciones_personales",naturaleza:"FLUJO_PARCIAL_NO_SALDO",ingresosCentavos:(ingresos*100n).toString(),gastosCentavos:(gastos*100n).toString(),flujoCentavos:((ingresos-gastos)*100n).toString(),excluidos,cantidad:rows.length,conciliableConSaldoV81:false});
}
module.exports={consultarFlujoHistoricoV81};
