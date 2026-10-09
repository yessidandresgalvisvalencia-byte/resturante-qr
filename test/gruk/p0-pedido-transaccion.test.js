'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPedidoService}=require('../../services/p0/crearPedidoConOutbox');
const tenant='507f1f77bcf86cd799439011',sede='507f1f77bcf86cd799439012',pedidoId='507f1f77bcf86cd799439013';
function setup({failOutbox=false,previous=null}={}){
 const calls=[],session={inTransaction:()=>true,async withTransaction(fn){calls.push('start');try{await fn();calls.push('commit')}catch(e){calls.push('rollback');throw e}},async endSession(){calls.push('end')}};
 const Receipt={findOne(){return {async lean(){return previous}}},async create(docs,opts){assert.equal(opts.session,session);calls.push('receipt');}};
 const Pedido={async create(docs,opts){assert.equal(opts.session,session);calls.push('pedido');return [{_id:pedidoId}]}};
 const svc=createPedidoService({mongoose:{startSession:async()=>session},Pedido,Receipt,async registrarEventoEnTransaccion(evt,s){assert.equal(s,session);assert.equal(evt.sedeId,sede);calls.push('outbox');if(failOutbox)throw Error('OUTBOX_FALLO')}});
 const args={restaurantId:'yessid',sedeId:'CENTRO',empresaId:tenant,key:'abcdefghijklmnop',intent:{menuItemId:'1',cantidad:1},resolverSedeCanonica:async()=>({restaurantId:'yessid',empresaId:tenant,sedeIdOriginal:'CENTRO',sedeObjectId:sede}),resolverAutorizado:async({session:s})=>{assert.equal(s,session);calls.push('authorize');return {restaurantId:'yessid',sedeId:'CENTRO',productoServicioId:'507f1f77bcf86cd799439014',precio:5000}}};
 return {svc,args,calls};
}
test('registra autorizacion, pedido, recibo, evento y commit en una transaccion',async()=>{const {svc,args,calls}=setup();const r=await svc.crear(args);assert.equal(r.replayed,false);assert.deepEqual(calls,['start','authorize','pedido','receipt','outbox','commit','end']);});
test('reverso transaccional si falla el evento persistente',async()=>{const {svc,args,calls}=setup({failOutbox:true});await assert.rejects(svc.crear(args),/OUTBOX_FALLO/);assert.deepEqual(calls,['start','authorize','pedido','receipt','outbox','rollback','end']);});
test('reintento mismo alcance recupera sin nueva transaccion',async()=>{const {digest}=require('../../services/p0/crearPedidoConOutbox');const intent={menuItemId:'1',cantidad:1};const {svc,args,calls}=setup({previous:{pedidoId,intentDigest:digest({empresaId:tenant,restaurantId:'yessid',sedeId:'CENTRO',intent})}});const r=await svc.crear(args);assert.equal(r.replayed,true);assert.equal(String(r.pedidoId),pedidoId);assert.deepEqual(calls,[]);});
test('misma clave con intencion distinta es rechazada',async()=>{const {svc,args}=setup({previous:{pedidoId,intentDigest:'otro'}});await assert.rejects(svc.crear(args),{statusCode:409});});
