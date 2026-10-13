"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../modules/finanzas-personales/models/movimientoFuentePersonal.model");
const ingestion=require("../../modules/finanzas-personales/services/financialIngestion.service");
test("movimiento de finanzas personales exige identidad, origen y monto seguros",async()=>{
 const uid=new mongoose.Types.ObjectId();
 await assert.rejects(()=>ingestion.registrarMovimiento(uid,{fuente:"GMAIL",cuentaFuente:"Bancolombia",referenciaExterna:"msg-1",montoMinor:0,direccion:"ENTRADA",moneda:"COP",evidencia:"NOTIFICACION",fechaMovimiento:new Date().toISOString()}),/Monto inválido/);
 await assert.rejects(()=>ingestion.registrarMovimiento(uid,{fuente:"GMAIL",cuentaFuente:"Bancolombia",referenciaExterna:"msg-1",montoMinor:1000,direccion:"ENTRADA",moneda:"COP",evidencia:"API_BANCARIA",fechaMovimiento:new Date().toISOString()}),/notificación no constituye confirmación bancaria/);
});
test("el modelo no permite un movimiento sin propietario",async()=>{
 const m=new Movimiento({fuente:"GMAIL",cuentaFuente:"Bancolombia",referenciaHash:"a".repeat(64),fechaMovimiento:new Date(),montoMinor:1000,direccion:"ENTRADA",evidencia:"NOTIFICACION"});
 const e=m.validateSync();
 assert.ok(e.errors.usuarioId);
 assert.equal(m.estado,"DETECTADO");
 assert.equal(m.transaccionId,null);
});
