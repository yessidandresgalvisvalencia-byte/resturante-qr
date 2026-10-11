'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=fs.readFileSync(path.join(__dirname,'../../routes/API.js'),'utf8');
test('Wompi transaction lookup without a transaction requests webhook retry instead of ACK',()=>{
 assert.match(api,/if \(!transaction\) return res\.status\(503\)\.json\(\{ ok: false, error: "WOMPI_TRANSACCION_NO_DISPONIBLE" \}\)/);
});
test('unresolved payment attempt or temporary state conflict requests webhook retry',()=>{
 assert.match(api,/\["INTENTO_NO_ENCONTRADO", "INTENTO_ESTADO_CONFLICTIVO"\]\.includes\(resultadoPedido\.reason\)/);
 assert.match(api,/return res\.status\(503\)\.json\(\{ ok: false, error: "PAGO_PENDIENTE_CONCILIACION" \}\)/);
});
