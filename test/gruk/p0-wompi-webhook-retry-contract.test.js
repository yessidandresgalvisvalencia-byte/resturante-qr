'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../routes/API.js'),'utf8');
test('verified order webhook with missing payment attempt responds 503 for retry',()=>{
 const start=source.indexOf('router.post("/wompi/webhook"');
 const end=source.indexOf('router.post("/registro-y-fuente-pago"',start);
 assert.ok(start>=0&&end>start);
 const route=source.slice(start,end);
 assert.match(route,/\["INTENTO_NO_ENCONTRADO", "INTENTO_ESTADO_CONFLICTIVO"\]\.includes\(resultadoPedido\.reason\)\) return res\.status\(503\)/);
 assert.match(route,/PAGO_PENDIENTE_CONCILIACION/);
 assert.match(route,/validarEventoWompi\(req\.body, checksumHeader, secretoEventos\)/);
});
