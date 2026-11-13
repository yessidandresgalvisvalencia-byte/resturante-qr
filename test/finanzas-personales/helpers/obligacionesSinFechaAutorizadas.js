"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Calendario=require("../../../modules/finanzas-personales/models/calendarioFinanciero.model");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const Tarjeta=require("../../../modules/finanzas-personales/models/DeudaPersonal");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const home=require("../../../modules/finanzas-personales/services/homePersonal.service");
const {evaluar}=require("../../../modules/finanzas-personales/services/gastoInteligentePersonal.service");
const {reconciliarCuenta}=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service");
async function probarObligacionesSinFechaAutorizadas(){
 const usuarioId=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId(),ahora=new Date();
 const diaMas=dias=>Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",day:"numeric"}).format(new Date(+ahora+dias*86400000)));
 const cuenta=await Cuenta.create({usuarioId,nombre:"EFECTIVO",tipo:"EFECTIVO",saldoMinor:1000000});
 await reconciliarCuenta(usuarioId,{cuentaId:String(cuenta._id),saldoMinor:1000000,fecha:new Date(+ahora-1000)});
 await Calendario.create({usuarioId,tipo:"INGRESO",concepto:"Ingreso de ensayo",montoMinor:2000000,diaMes:diaMas(10)});
 const dato={direccion:"POR_PAGAR",estado:"ACTIVO",contraparte:"Ensayo",concepto:"Deuda por confirmar",
  principalMinor:100000,saldoMinor:100000,cuotaMinor:10000,fechaInicio:new Date(+ahora-86400000)};
 await Prestamo.create({...dato,usuarioId:otro});
 assert.equal((await home.obtener(usuarioId,ahora)).asesor.aptoParaDisponibleHoy,true);
 const deuda=await Prestamo.create({...dato,usuarioId});
 const estado=async()=>({
  cuentas:await Cuenta.find({usuarioId}).lean(),prestamos:await Prestamo.find({usuarioId}).lean(),
  tarjetas:await Tarjeta.find({usuarioId}).lean(),tx:await Tx.find({usuarioId}).lean(),
  outbox:await Outbox.find({usuarioId}).lean()
 });
 const comprobarBloqueo=async tipo=>{
  const antes=await estado(),panel=await home.obtener(usuarioId,ahora);
  assert.equal(panel.asesor.saldoConfiabilidad,"VERIFICADO");
  assert.equal(panel.asesor.aptoParaDisponibleHoy,false);
  assert.equal(panel.asesor.disponibleHoyMinor,null);assert.equal(panel.asesor.gastoMaximoSiGravadoMinor,null);
  assert.equal(panel.asesor.obligacionesSinFecha.length,1);
  assert.equal(panel.asesor.obligacionesSinFecha[0].tipo,tipo);
  assert.equal(panel.verdadFinanciera.disponibleHoy.requiereReconciliacion,true);
  assert.equal(panel.verdadFinanciera.disponibleHoy.montoMinor,0);
  const aviso=panel.decisiones.find(d=>d.accion==="CONFIRMAR_FECHA_PAGO");
  assert.ok(aviso);assert.equal(aviso.montoMinor,null);
  assert.equal((await evaluar(usuarioId,{montoMinor:1000},{ahora})).estado,"FALTAN_DATOS");
  assert.deepEqual(await estado(),antes);
 };
 await comprobarBloqueo("PRESTAMO");
 await Prestamo.updateOne({_id:deuda._id,usuarioId},{$set:{fechaVencimiento:new Date(+ahora+2*86400000)}});
 const fechado=await home.obtener(usuarioId,ahora);
 assert.equal(fechado.asesor.aptoParaDisponibleHoy,true);
 assert.equal(fechado.asesor.disponibleHoyMinor,890000);
 assert.deepEqual(fechado.asesor.obligacionesSinFecha,[]);
 await Prestamo.updateOne({_id:deuda._id,usuarioId},{$set:{fechaVencimiento:null,saldoMinor:0,estado:"PAGADO"}});
 assert.equal((await home.obtener(usuarioId,ahora)).asesor.aptoParaDisponibleHoy,true);
 // Fuente histórica incompleta ficticia insertada solo en la base aislada: no se usa
 // save/validación del modelo para fabricar una tarjeta que la UI actual rechaza.
 const id=new mongoose.Types.ObjectId();
 await Tarjeta.collection.insertOne({_id:id,usuarioId,tipo:"TARJETA_CREDITO",activa:true,
  nombre:"Tarjeta histórica de ensayo",saldoMinor:100000,pagoMinimoMinor:10000,
  cuotaMensualMinor:10000,cupoTotalMinor:200000,cupoDisponibleMinor:100000,
  tasaMensualPct:0,mesesRestantes:10,moneda:"COP",diaCorte:1,diaPago:null});
 await comprobarBloqueo("TARJETA_CREDITO");
 await Tarjeta.updateOne({_id:id,usuarioId},{$set:{diaPago:diaMas(2)}});
 const confirmado=await home.obtener(usuarioId,ahora);
 assert.equal(confirmado.asesor.aptoParaDisponibleHoy,true);
 assert.equal(confirmado.asesor.disponibleHoyMinor,890000);
 assert.deepEqual(confirmado.asesor.obligacionesSinFecha,[]);
 assert.equal((await evaluar(usuarioId,{montoMinor:1000},{ahora})).estado,"CABE");
}
module.exports={probarObligacionesSinFechaAutorizadas};
