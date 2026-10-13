"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {interpretarAviso,normalizarCOP}=require("../../modules/finanzas-personales/services/gmailAvisoPersonal.parser");
test("parser de notificaciones financieras exige una cifra COP inequívoca",()=>{
 assert.equal(normalizarCOP("200.000"),200000);
 assert.equal(normalizarCOP("200,50"),null);
 assert.equal(normalizarCOP("2.00.000"),null);
 const base={messageId:"abc",from:"alertas@bancolombia.com",subject:"Recibiste una transferencia",text:"Recibiste $200.000",date:"2026-10-13T10:00:00Z",cuentaFuente:"Bancolombia"};
 const ok=interpretarAviso(base);
 assert.equal(ok.aceptado,true);
 assert.equal(ok.movimiento.montoMinor,200000);
 assert.equal(ok.movimiento.direccion,"ENTRADA");
 assert.equal(ok.movimiento.evidencia,"NOTIFICACION");
 assert.equal(interpretarAviso({...base,text:"Recibiste $200.000 y saldo $800.000"}).motivo,"MONTO_AMBIGUO");
 assert.equal(interpretarAviso({...base,from:"persona@example.com"}).motivo,"REMITENTE_NO_RECONOCIDO");
 assert.equal(interpretarAviso({...base,subject:"Recibiste y enviaste dinero"}).motivo,"DIRECCION_AMBIGUA");
});
