'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {habilitado,iniciarOutboxWorker}=require('../../services/p0/outbox.worker');
test('worker disabled with no flags',()=>assert.equal(habilitado({NODE_ENV:'test'}),false));
test('worker is disabled in production even with flags',()=>assert.equal(habilitado({NODE_ENV:'production',GRUK_P0_OUTBOX_WORKER_ENABLED:'true',GRUK_P0_PEDIDOS_ENABLED:'true'}),false));
test('worker needs both opt-in flags in test/staging',()=>{
 assert.equal(habilitado({NODE_ENV:'test',GRUK_P0_OUTBOX_WORKER_ENABLED:'true',GRUK_P0_PEDIDOS_ENABLED:'false'}),false);
 assert.equal(habilitado({NODE_ENV:'test',GRUK_P0_OUTBOX_WORKER_ENABLED:'true',GRUK_P0_PEDIDOS_ENABLED:'true'}),true);
});
test('disabled worker cannot schedule any timers',()=>{const worker=iniciarOutboxWorker({env:{NODE_ENV:'production',GRUK_P0_OUTBOX_WORKER_ENABLED:'true',GRUK_P0_PEDIDOS_ENABLED:'true'}});assert.equal(worker.started,false);worker.stop();});
test('enabled worker rejects invalid socket',()=>{assert.throws(()=>iniciarOutboxWorker({env:{NODE_ENV:'test',GRUK_P0_OUTBOX_WORKER_ENABLED:'true',GRUK_P0_PEDIDOS_ENABLED:'true'}}),/OUTBOX_SOCKET_INVALIDO/);});
