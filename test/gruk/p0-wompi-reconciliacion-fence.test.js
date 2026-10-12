'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const payments=fs.readFileSync(path.join(__dirname,'../../services/pagosPedidos.service.js'),'utf8');
const reconciler=fs.readFileSync(path.join(__dirname,'../../services/p0/conciliarPendientesWompi.js'),'utf8');
test('reconciler passes its owned lease token into confirmation',()=>{
 assert.match(reconciler,/confirmar\(\{transaction,io,conciliacionToken:token\}\)/);
});
test('payment settlement rechecks lease ownership and expiry inside Mongo transaction',()=>{
 const start=payments.indexOf('await session.withTransaction(async () => {');
 const owner=payments.indexOf('lockedIntento.conciliacionToken !== conciliacionToken',start);
 const expiry=payments.indexOf('lockedIntento.conciliacionLeaseUntil <= new Date()',start);
 const sale=payments.indexOf('const resultado = await registrarVentaDesdePedido',start);
 assert.ok(start>=0&&owner>start&&expiry>start&&sale>owner&&sale>expiry);
 assert.match(payments,/CONCILIACION_RESERVA_PERDIDA/);
});

test('final ACID settlement write is fenced by a live lease after sale and outbox',()=>{
 const sale=payments.indexOf('const resultado = await registrarVentaDesdePedido');
 const fence=payments.indexOf('const result = await IntentoPagoPedido.updateOne({',sale);
 const expiry=payments.indexOf('conciliacionLeaseUntil: { $gt: new Date() }',fence);
 const commit=payments.indexOf('}, { session });',fence);
 assert.ok(sale>=0&&fence>sale&&expiry>fence&&commit>expiry);
 assert.match(payments.slice(fence,commit+130),/if \(result\.modifiedCount !== 1\) throw new Error\("CONCILIACION_RESERVA_PERDIDA"\)/);
});
