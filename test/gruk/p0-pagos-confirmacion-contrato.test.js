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

test('Wompi amount must be a positive safe integer matching persisted cents',()=>{
 assert.match(source,/Number\.isSafeInteger\(transaction\.amount_in_cents\)/);
 assert.match(source,/transaction\.amount_in_cents === intento\.amountInCents/);
});
test('transactional settlement refuses conflicting gateway transaction identifiers',()=>{
 assert.match(source,/TRANSACCION_REFERENCIA_CONFLICTIVA/);
 assert.match(source,/TRANSACCION_APROBADA_DIFERENTE/);
 const lock=source.indexOf('const lockedIntento = await IntentoPagoPedido.findOne');
 const check=source.indexOf('TRANSACCION_REFERENCIA_CONFLICTIVA',lock);
 const mark=source.indexOf('lockedIntento.estado = "APROBADO"');
 assert.ok(lock>=0&&check>lock&&mark>check);
});

test('transient transaction retry clears rolled back post-commit notifications',()=>{
 const start=source.indexOf('await session.withTransaction(async () => {');
 const resetSales=source.indexOf('ventasPostCommit.length = 0;',start);
 const resetOrders=source.indexOf('pedidosPostCommit.length = 0;',start);
 const read=source.indexOf('const lockedIntento = await IntentoPagoPedido.findOne',start);
 assert.ok(start>=0 && resetSales>start && resetOrders>start && resetSales<read && resetOrders<read);
});

test('unknown gateway statuses cannot mutate an existing payment attempt',()=>{
 const guard=source.indexOf('ESTADO_WOMPI_DESCONOCIDO');
 const assignment=source.indexOf('intento.transactionId = String(transaction.id || "")');
 assert.ok(guard>=0 && assignment>guard);
 assert.match(source,/TRANSACCION_ID_INVALIDO/);
});
test('a different gateway transaction cannot take over the payment reference',()=>{
 const fence=source.indexOf('TRANSACCION_REFERENCIA_CONFLICTIVA');
 const assignment=source.indexOf('intento.transactionId = String(transaction.id || "")');
 assert.ok(fence>=0 && assignment>fence);
});
