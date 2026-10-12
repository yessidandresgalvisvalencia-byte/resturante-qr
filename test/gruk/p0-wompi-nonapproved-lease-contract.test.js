'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../services/pagosPedidos.service.js'),'utf8');
test('non-approved reconciliation update is fenced by token and active lease',()=>{
 const section=source.slice(source.indexOf('if (status !== "APPROVED")'),source.indexOf('const session = await mongoose.startSession()'));
 assert.match(section,/conciliacionToken !== null \? \{/);
 assert.match(section,/conciliacionLeaseUntil: \{ \$gt: new Date\(\) \}/);
 assert.match(section,/CONCILIACION_RESERVA_PERDIDA/);
});
