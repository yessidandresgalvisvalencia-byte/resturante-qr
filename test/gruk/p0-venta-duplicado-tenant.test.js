'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../../services/ventas.service.js'),'utf8');
test('duplicate sale recovery requires matching company, order and origin',()=>{
 const idx=src.indexOf('if (error && error.code === 11000)');
 assert.ok(idx>=0);
 const fallback=src.slice(idx,idx+700);
 assert.match(fallback,/origen:\s*"restaurante"/);
 assert.match(fallback,/origenId:\s*pedido\._id/);
 assert.match(fallback,/empresaId/);
 assert.match(fallback,/if \(!ventaExistente\) throw error/);
});
