'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crearConciliadorWompi}=require('../../services/p0/conciliarPendientesWompi');

function fixture(pendientes,consultar,confirmar){
 const calls=[];
 const IntentoModel={find(q){calls.push(q);return {sort(){return {limit(limit){calls.push(limit);return {lean:async()=>pendientes};}}}}},async findOneAndUpdate(query){calls.push({claim:query});return pendientes.find(p=>p._id===query._id)||null},findOne(query){calls.push({fence:query});return {lean:async()=>({_id:query._id})}},async updateOne(query){calls.push({release:query});return {modifiedCount:1}}};
 const conciliar=crearConciliadorWompi({IntentoModel,consultar,confirmar,habilitado:({restaurantId})=>restaurantId==='allowed'});
 return {conciliar,calls};
}
test('reconciles stored Wompi transaction only when id and reference match',{timeout:10000},async()=>{
 const item={_id:'attempt-1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 let applied=0;
 const f=fixture([item],async()=>({id:'tx1',reference:item.reference,status:'APPROVED',amount_in_cents:10000,currency:'COP'}),async()=>{applied++;return {handled:true,ok:true,estado:'APROBADO'};});
 assert.deepEqual(await f.conciliar({restaurantId:'allowed'}),{checked:1,approved:1,unchanged:0,failed:0});
 assert.equal(applied,1);
 assert.deepEqual(f.calls[0].estado,{$in:['CREADO','PENDIENTE','RECHAZADO']});
 assert.equal(f.calls[0].restaurantId,'allowed');
 assert.equal(f.calls[1],20);
});
test('rejects mismatched payment reference without applying finance',{timeout:10000},async()=>{
 let applied=0;
 const f=fixture([{_id:'attempt-1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'}],async()=>({id:'tx1',reference:'OTHER'}),async()=>{applied++;return {handled:true,ok:true,estado:'APROBADO'};});
 assert.equal((await f.conciliar({restaurantId:'allowed'})).failed,1);
 assert.equal(applied,0);
});
test('fail closed for disabled tenants and invalid limits',async()=>{
 const f=fixture([],async()=>{},async()=>{});
 await assert.rejects(f.conciliar({restaurantId:'denied'}),/CONCILIACION_P0_NO_HABILITADA/);
 await assert.rejects(f.conciliar({restaurantId:'allowed',limit:1000}),/CONCILIACION_LIMITE_INVALIDO/);
 assert.equal(f.calls.length,0);
});

test('locked attempt is skipped before remote Wompi lookup',async()=>{
 let calls=0;
 const Model={
  find(){return {sort(){return {limit(){return {lean:async()=>[{_id:'attempt-locked',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'}]};}}}}},
  async findOneAndUpdate(){return null;},
  async updateOne(){throw Error('MUST_NOT_RELEASE_UNCLAIMED_ATTEMPT');}
 };
 const run=crearConciliadorWompi({IntentoModel:Model,consultar:async()=>{calls++;},confirmar:async()=>{calls++;},habilitado:()=>true});
 assert.deepEqual(await run({restaurantId:'allowed'}),{checked:0,approved:0,unchanged:0,failed:0});
 assert.equal(calls,0);
});

test('expired or stolen lease after gateway response is never settled',async()=>{
 let confirmed=0;
 const attempt={_id:'stale-1',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 const Model={
  find(){return {sort(){return {limit(){return {lean:async()=>[attempt]};}}}}},
  async findOneAndUpdate(){return attempt;},
  findOne(){return {lean:async()=>null};},
  async updateOne(){return {modifiedCount:0};}
 };
 const run=crearConciliadorWompi({IntentoModel:Model,habilitado:()=>true,
  consultar:async()=>({id:'tx1',reference:attempt.reference,status:'APPROVED',amount_in_cents:10000,currency:'COP'}),
  confirmar:async()=>{confirmed++;return {handled:true,ok:true,estado:'APROBADO'};}});
 const result=await run({restaurantId:'allowed'});
 assert.equal(result.failed,1);
 assert.equal(confirmed,0);
});

test('rejects Wompi amount and currency discrepancies before financial confirmation',async()=>{
 const item={_id:'attempt-amount',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 for(const payload of [
  {amount_in_cents:9000,currency:'COP'},
  {amount_in_cents:10000,currency:'USD'},
  {amount_in_cents:'10000',currency:'COP'}
 ]){
  let confirmed=0;
  const f=fixture([item],async()=>({id:'tx1',reference:item.reference,status:'APPROVED',...payload}),
   async()=>{confirmed++;return {handled:true,ok:true,estado:'APROBADO'};});
  const result=await f.conciliar({restaurantId:'allowed'});
  assert.equal(result.failed,1);
  assert.equal(confirmed,0);
  assert.equal(f.calls.find(x=>x.release)?.release?._id,item._id);
 }
});

test('unknown Wompi status must not enter financial settlement',async()=>{
 const item={_id:'attempt-invalid-status',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 let confirmations=0;
 const f=fixture([item],async()=>({id:'tx1',reference:item.reference,status:'UNKNOWN',amount_in_cents:10000,currency:'COP'}),async()=>{confirmations++;return {handled:true,ok:true,estado:'APROBADO'};});
 const outcome=await f.conciliar({restaurantId:'allowed'});
 assert.equal(outcome.failed,1);
 assert.equal(confirmations,0);
 assert.equal(f.calls.filter(x=>x.release).length,1);
});

test('validates payment economics from atomic claim instead of stale scan',async()=>{
 let applied=0;
 const stale={_id:'changed-amount',reference:'GRUK_PEDIDO_1',transactionId:'tx1',amountInCents:10000,currency:'COP'};
 const Model={
  find(){return {sort(){return {limit(){return {lean:async()=>[stale]};}}}}},
  async findOneAndUpdate(){return {...stale,amountInCents:20000};},
  findOne(){return {lean:async()=>stale};},
  async updateOne(){return {modifiedCount:1};}
 };
 const run=crearConciliadorWompi({IntentoModel:Model,habilitado:()=>true,
  consultar:async()=>({id:'tx1',reference:stale.reference,status:'APPROVED',amount_in_cents:10000,currency:'COP'}),
  confirmar:async()=>{applied++;return {handled:true,ok:true,estado:'APROBADO'};}});
 const result=await run({restaurantId:'allowed'});
 assert.equal(result.failed,1);
 assert.equal(applied,0);
});
