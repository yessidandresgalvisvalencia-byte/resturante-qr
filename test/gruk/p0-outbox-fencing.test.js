'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=fs.readFileSync(path.join(__dirname,'../../services/p0/outbox.service.js'),'utf8');
const model=fs.readFileSync(path.join(__dirname,'../../models/GrukOutbox.js'),'utf8');
test('outbox records a per-lease fencing token',()=>assert.match(model,/claimToken:\{type:String,default:null\}/));
test('each claimed event receives a fresh random token',()=>assert.match(service,/const claimToken=crypto\.randomUUID\(\)/));
test('claim stores fencing token',()=>assert.match(service,/claimedBy:workerId,claimToken\}/));
test('both acknowledgements are fenced to the same claim',()=>{
 assert.match(service,/status:'DONE'[^\n]*claimToken/);
 assert.match(service,/status:'PENDING'[^\n]*claimToken/);
});
test('fencing token is cleared after acknowledgement or retry',()=>{
 assert.equal((service.match(/claimToken:null/g)||[]).length,2);
});
