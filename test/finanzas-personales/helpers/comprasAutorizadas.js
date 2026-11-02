"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Calendario=require("../../../modules/finanzas-personales/models/calendarioFinanciero.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {reconciliarCuenta}=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service");
const {evaluar}=require("../../../modules/finanzas-personales/services/gastoInteligentePersonal.service");
async function probarComprasAutorizadas(){
 const usuarioId=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId();
 const cuenta=await Cuenta.create({usuarioId,nombre:"EFECTIVO",tipo:"EFECTIVO",saldoMinor:1000000});
 await reconciliarCuenta(usuarioId,{cuentaId:String(cuenta._id),saldoMinor:1000000,fecha:new Date(Date.now()-1000)});
 const ahora=new Date(),diaMes=Number(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/Bogota",day:"numeric"
 }).format(new Date(+ahora+2*86400000)));
 const ingreso=await Calendario.create({usuarioId,tipo:"INGRESO",concepto:"Ingreso de ensayo",montoMinor:2000000,diaMes});
 const estado=async()=>({
  cuentas:await Cuenta.find({usuarioId}).lean(),calendario:await Calendario.find({usuarioId}).lean(),
  tx:await Tx.find({usuarioId}).lean(),outbox:await Outbox.find({usuarioId}).lean()
 });
 const antes=await estado();
 const compra=await evaluar(usuarioId,{montoMinor:100000},{ahora});
 assert.equal(compra.estado,"CABE");assert.equal(compra.restanteMinor,800000);
 assert.ok(compra.consecuencia.diasHastaIngreso>0);
 assert.equal((await evaluar(usuarioId,{montoMinor:1000000},{ahora})).estado,"NO_CABE");
 assert.equal((await evaluar(usuarioId,{montoMinor:1000000,obligatorio:true},{ahora})).estado,"REQUIERE_PLAN");
 assert.equal((await evaluar(otro,{montoMinor:1},{ahora})).estado,"FALTAN_DATOS");
 assert.deepEqual(await estado(),antes);
 // Calendario mutable de ensayo: un ingreso sin importe no habilita una compra.
 await Calendario.updateOne({_id:ingreso._id,usuarioId},{$set:{montoMinor:0}});
 const sinIngreso=await estado();
 const rechazo=await evaluar(usuarioId,{montoMinor:1},{ahora});
 assert.deepEqual(Object.keys(rechazo).sort(),["estado","mensaje"]);
 assert.equal(rechazo.estado,"FALTAN_DATOS");assert.deepEqual(await estado(),sinIngreso);
 await Calendario.updateOne({_id:ingreso._id,usuarioId},{$set:{montoMinor:2000000}});
 await Cuenta.updateOne({_id:cuenta._id,usuarioId},{$set:{requiereReconciliacion:true}});
 const pendiente=await estado();
 assert.equal((await evaluar(usuarioId,{montoMinor:1},{ahora})).estado,"FALTAN_DATOS");
 assert.deepEqual(await estado(),pendiente);
}
module.exports={probarComprasAutorizadas};
