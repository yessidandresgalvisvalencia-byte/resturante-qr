'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8');
test('Wompi reconciler starts after MongoDB connection and remains opt-in',()=>{
 const connect=source.indexOf('await mongoose.connect(');
 const recovery=source.indexOf('require("./services/p0/conciliadorWompi.worker").iniciarConciliadorWompi({io})');
 const server=source.indexOf('server.listen(PORT',connect);
 assert.ok(connect>=0&&recovery>connect&&server>recovery);
 assert.ok(source.includes('iniciarConciliadorWompi({io})'));
});
