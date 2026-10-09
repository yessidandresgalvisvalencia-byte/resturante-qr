'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('pedido nuevo no se publica globalmente',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../../routes/API.js'),'utf8');
 const a=src.indexOf('router.post("/pedido"');
 const b=src.indexOf('router.get("/pedidos"',a);
 assert.ok(a>=0 && b>a,'ruta de pedidos no encontrada');
 const route=src.slice(a,b);
 assert.equal(route.includes('io.emit('),false,'notificacion publica global');
 assert.match(route,/io\.to\(\x60empresa-\$\{String\(restaurante\.empresaId\)\}\x60\)\.emit\(/);
});
