'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {obtenerPendientesRevisionWompi}=require('../../services/p0/revisionManualWompi');
test('Wompi manual review is tenant scoped, bounded and redacts transaction ID',async()=>{
 const calls=[];
 const Model={find(query){calls.push(query);return {
  select(projection){calls.push(projection);return {
   sort(){return {limit(n){calls.push(n);return {lean:async()=>[
    {reference:'GRUK_PEDIDO_missing',transactionId:'',estado:'CREADO',conciliacionIntentos:0},
    {reference:'GRUK_PEDIDO_exhausted',transactionId:'txn-sensitive',estado:'PENDIENTE',conciliacionIntentos:12}
   ]};}}};}
  };}
 }}};
 const result=await obtenerPendientesRevisionWompi({restaurantId:'tenant-one',IntentoModel:Model,habilitado:()=>true});
 assert.equal(calls[0].restaurantId,'tenant-one');
 assert.deepEqual(calls[0].estado,{$in:['CREADO','PENDIENTE','RECHAZADO']});
 assert.deepEqual(calls[0].$or[1],{conciliacionIntentos:{$gte:12}});
 assert.equal(calls[2],50);
 assert.deepEqual(result.map(x=>x.razon),['TRANSACCION_ID_AUSENTE','REINTENTOS_AGOTADOS']);
 assert.equal(JSON.stringify(result).includes('txn-sensitive'),false);
});
test('manual review rejects disabled tenants and unbounded queries',async()=>{
 await assert.rejects(obtenerPendientesRevisionWompi({restaurantId:'other',habilitado:()=>false}),/REVISION_WOMPI_NO_HABILITADA/);
 await assert.rejects(obtenerPendientesRevisionWompi({restaurantId:'one',limite:101,habilitado:()=>true}),/REVISION_WOMPI_LIMITE_INVALIDO/);
});
