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
