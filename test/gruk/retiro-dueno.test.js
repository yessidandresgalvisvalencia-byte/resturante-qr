"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
const CuentaTesoreria=require("../../core/finanzas/models/CuentaTesoreria");
const MovimientoCaja=require("../../core/finanzas/models/MovimientoCaja");
const ReservaCaja=require("../../core/finanzas/models/ReservaCaja");
const RetiroDueno=require("../../core/finanzas/models/RetiroDueno");
const {crearCuenta}=require("../../core/finanzas/tesoreria.service");
const {construirProyeccionTesoreria}=require("../../core/finanzas/tesoreriaProyeccion.service");
const {evaluarRetiroSeguro,registrarRetiroDueno}=require("../../core/finanzas/retiroDueno.service");
const USER="507f1f77bcf86cd799439903";
let empresa,cuenta,reserva;
async function nuevaEmpresa(){const s=new mongoose.Types.ObjectId().toString().slice(-8);return Empresa.create({empresaId:`empresa-${s}`,nombre:`Empresa ${s}`,tipoNegocio:"restaurante",correo:`${s}@example.com`});}
test.before(async()=>{const uri=process.env.TEST_MONGO_URI;if(!uri)throw new Error("TEST_MONGO_URI requerido");await mongoose.connect(uri,{dbName:"gruk_test_retiros_dueno"});});
test.after(async()=>mongoose.disconnect());
test.beforeEach(async()=>{
 await Promise.all([Empresa.deleteMany({}),CuentaTesoreria.deleteMany({}),MovimientoCaja.deleteMany({}),ReservaCaja.deleteMany({}),RetiroDueno.deleteMany({})]);
 empresa=await nuevaEmpresa();
 cuenta=await crearCuenta({empresaId:empresa._id,nombre:"Banco principal",tipo:"BANCO",saldoInicial:1000000,saldoInicialAt:new Date(Date.now()-86400000),createdBy:USER});
 reserva=await ReservaCaja.create({empresaId:empresa._id,categoria:"UTILIDAD_DUENO",monto:300000,estado:"ACTIVA",origenTipo:"MANUAL",concepto:"Utilidad dueño prueba",approvedBy:USER,approvedAt:new Date(),createdBy:USER,deletedAt:null});
});
test("retiro seguro hoy si reserva esta respaldada",async()=>{
 const d=await evaluarRetiroSeguro({empresaId:empresa._id,reservaId:reserva._id});
 assert.equal(d.estado,"SEGURO_HOY");
 assert.equal(d.puedeRetirarHoy,true);
 assert.equal(d.montoMaximoHoy,300000);
});
test("retiro parcial conserva caja operativa libre",async()=>{
 const antes=await construirProyeccionTesoreria({empresaId:empresa._id});
 assert.equal(antes.saldoActual,1000000);
 assert.equal(antes.saldoLibreOperativo,700000);
 const r=await registrarRetiroDueno({empresaId:empresa._id,reservaId:reserva._id,cuentaTesoreriaId:cuenta._id,monto:100000,createdBy:USER});
 assert.equal(r.reserva.estado,"ACTIVA");
 assert.equal(r.reserva.saldoRestante,200000);
 const despues=await construirProyeccionTesoreria({empresaId:empresa._id});
 assert.equal(despues.saldoActual,900000);
 assert.equal(despues.reservasActivas.utilidadDueno,200000);
 assert.equal(despues.saldoLibreOperativo,700000);
 const mov=await MovimientoCaja.findOne({origenTipo:"RETIRO_DUENO"}).lean();
 assert.equal(mov.direccion,"SALIDA");
 assert.equal(mov.monto,100000);
});
test("retiro total consume reserva",async()=>{
 const r=await registrarRetiroDueno({empresaId:empresa._id,reservaId:reserva._id,cuentaTesoreriaId:cuenta._id,monto:300000,createdBy:USER});
 assert.equal(r.reserva.estado,"CONSUMIDA");
 assert.equal(r.reserva.saldoRestante,0);
 const db=await ReservaCaja.findById(reserva._id).lean();
 assert.ok(db.consumidaAt);
});
test("bloquea retiro si reservas no estan respaldadas",async()=>{
 await ReservaCaja.create({empresaId:empresa._id,categoria:"IMPUESTOS",monto:800000,estado:"ACTIVA",origenTipo:"MANUAL",concepto:"Reserva impuestos",approvedBy:USER,approvedAt:new Date(),createdBy:USER,deletedAt:null});
 const d=await evaluarRetiroSeguro({empresaId:empresa._id,reservaId:reserva._id});
 assert.equal(d.estado,"RESERVAS_NO_RESPALDADAS");
 assert.equal(d.puedeRetirarHoy,false);
 assert.equal(d.respaldoFaltante,100000);
 await assert.rejects(()=>registrarRetiroDueno({empresaId:empresa._id,reservaId:reserva._id,cuentaTesoreriaId:cuenta._id,monto:100000,createdBy:USER}),/Faltan 100000/);
});
