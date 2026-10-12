'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../services/p0/conciliarPendientesWompi.js'),'utf8');
test('gateway client has fixed HTTPS origin, rejects redirects and bounds response',()=>{
 assert.match(source,/https:\/\/production\.wompi\.co\/v1\/transactions\//);
 assert.match(source,/maxRedirects:0/);
 assert.match(source,/maxContentLength:262144/);
 assert.match(source,/timeout:10000/);
 assert.match(source,/WOMPI_ID_INVALIDO/);
 assert.match(source,/encodeURIComponent\(id\)/);
});
