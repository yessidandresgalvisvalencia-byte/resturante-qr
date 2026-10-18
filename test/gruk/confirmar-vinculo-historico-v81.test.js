"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resolverConfirmacion}=require("../../modules/finanzas-personales/services/confirmarVinculoHistoricoV81.service");
const uid="507f1f77bcf86cd799439011";
const movimiento={_id:"507f1f77bcf86cd799439012",usuarioId:uid,cuentaId:null,
 estado:"ACTIVA",moneda:"COP"};
const cuenta={_id:"507f1f77bcf86cd799439013",usuarioId:uid,activa:true,moneda:"COP"};
const base={usuarioId:uid,movimiento,cuenta,evidencia:"Extracto bancario revisado",
 idempotencyKey:"1c279cce-fcf1-49e2-9271-9662d2fb2ee7"};
test("vínculo explícito produce sólo evidencia, sin tocar saldo",()=>{
 const x=resolverConfirmacion(base);
 assert.equal(x.movimientoId,movimiento._id);
 assert.equal(x.cuentaId,cuenta._id);
 assert.equal(Object.hasOwn(x,"saldoMinor"),false);
 assert.equal(Object.hasOwn(x,"montoMinor"),false);
});
test("otro usuario o movimiento vinculado no puede confirmar",()=>{
 assert.throws(()=>resolverConfirmacion({...base,usuarioId:"507f1f77bcf86cd799439099"}),e=>e.statusCode===404);
 assert.throws(()=>resolverConfirmacion({...base,movimiento:{...movimiento,cuentaId:cuenta._id}}),e=>e.statusCode===409);
});
test("movimientos anulados y cuentas inactivas se rechazan",()=>{
 assert.throws(()=>resolverConfirmacion({...base,movimiento:{...movimiento,estado:"ANULADA"}}),e=>e.statusCode===409);
 assert.throws(()=>resolverConfirmacion({...base,cuenta:{...cuenta,activa:false}}),e=>e.statusCode===409);
});
test("sin evidencia o clave idempotente válida se bloquea",()=>{
 assert.throws(()=>resolverConfirmacion({...base,evidencia:"sin prueba"}),e=>e.statusCode===400);
 assert.throws(()=>resolverConfirmacion({...base,idempotencyKey:"cualquier cosa"}),e=>e.statusCode===400);
});
