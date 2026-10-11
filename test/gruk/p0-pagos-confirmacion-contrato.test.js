'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../services/pagosPedidos.service.js'),'utf8');
test('confirmacion Wompi comparte validador exacto de COP con inicio de pago',()=>{
 assert.match(source,/calcularImportePagoCentavos\(pedidos\)/);
 assert.doesNotMatch(source,/Math\.round\(Number\(p\.precio\)\s*\*\s*100\)/);
});
test('las actualizaciones de pedidos pagados no se emiten globalmente',()=>{
 assert.match(source,/io\.to\(`empresa-\$\{empresaNotificacionId\}\`\)\.emit\("pedido:actualizado"/);
 assert.doesNotMatch(source,/io\.emit\("pedido:actualizado"/);
});

test('a settled approved intent is protected before any mutable webhook status',()=>{
 const guard=source.indexOf('if (intento.estado === "APROBADO")');
 const mutation=source.indexOf('intento.transactionId = String(transaction.id || "")');
 assert.ok(guard>=0&&mutation>guard,'the immutable approved guard must precede status mutation');
 assert.match(source,/TRANSACCION_APROBADA_DIFERENTE/);
});
