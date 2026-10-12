'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sales=fs.readFileSync(path.join(__dirname,'../../services/ventas.service.js'),'utf8');
const payments=fs.readFileSync(path.join(__dirname,'../../services/pagosPedidos.service.js'),'utf8');
test('Wompi confirms card payment method before sale is persisted in ACID transaction',()=>{
 assert.match(sales,/metodoPagoConfirmado = null/);
 assert.match(sales,/metodoPago: metodoPagoConfirmado \|\| pedido\.metodoPago \|\| ""/);
 const saleCall=payments.indexOf('const resultado = await registrarVentaDesdePedido');
 const paymentMethod=payments.indexOf("metodoPagoConfirmado: 'tarjeta'",saleCall);
 const persist=payments.indexOf('await pedido.save({ session })',saleCall);
 assert.ok(saleCall>=0&&paymentMethod>saleCall&&persist>paymentMethod);
});
