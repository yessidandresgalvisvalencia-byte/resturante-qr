'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('express'),Module=require('node:module');
const A='a'.repeat(24),B='b'.repeat(24),S='c'.repeat(24),T='d'.repeat(24),U='e'.repeat(24);
const ids=['1','2','3','4'].map(x=>x.repeat(24));
test('catalog HTTP enforces tenant and branch scope across CRUD',async()=>{
 const rows=[{_id:ids[0],empresaId:A,sedeId:null},{_id:ids[1],empresaId:A,sedeId:S},{_id:ids[2],empresaId:A,sedeId:T},{_id:ids[3],empresaId:B,sedeId:U}];
 const matches=(r,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&v.$in?v.$in.includes(r[k]):r[k]===v);
 class Product {
  constructor(x){Object.assign(this,x);}
  async save(){rows.push({...this});}
  static find(q){return {sort:async()=>rows.filter(r=>matches(r,q))};}
  static async findOneAndUpdate(q,u){const r=rows.find(r=>matches(r,q));if(!r)return null;Object.assign(r,u.$set||u);return r;}
 }
 const real=process.env.GRUK_CATALOG_MONGO_DRILL==='1';
 let conn, Model=Product;
 if(real){
  const mongoose=require('mongoose');
  conn=mongoose.createConnection('mongodb://127.0.0.1:27017',{dbName:'gruk_catalog_drill_'+require('node:crypto').randomBytes(12).toString('hex'),serverSelectionTimeoutMS:5000});
  try{await conn.asPromise();Model=conn.model('ProductoServicio',require('../../models/ProductoServicio').schema);await Model.create(rows.map((r,i)=>({...r,nombre:'fixture-'+i,tipo:'producto',precioVenta:1})));}catch(e){await conn.close();throw e;}
 }
 try{
 const load=Module._load;
 let router;
 try{
  Module._load=function(request,parent,...rest){
   if(parent?.filename.endsWith('/routes/productosServicios.js')){
    if(request==='../models/ProductoServicio')return Model;
    if(request==='../models/Empresa')return {findById:async id=>({_id:id})};
    if(request==='../models/sede')return {findOne:q=>({select:()=>({lean:async()=>q.empresaId===A&&[S,T].includes(q._id)?{_id:q._id}:null})})};
    if(request==='../core/auth/auth.middleware')return (req,res,next)=>{req.auth={empresaId:A,sedeId:req.get('x-test-site')||null,rol:req.get('x-test-role')};next();};
   }
   return load.call(this,request,parent,...rest);
  };
  router=require('../../routes/productosServicios');
 }finally{Module._load=load;}
 const app=express();app.use(express.json());app.use(router);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  async function call(method,path,body,role='ADMIN_SEDE',site=S){
   const res=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{'content-type':'application/json','x-test-role':encodeURIComponent(role)==='DUE%C3%91O'?'DUEÑO':role,'x-test-site':site},...(body?{body:JSON.stringify(body)}:{})});
   return {status:res.status,body:await res.json()};
  }
  assert.deepEqual((await call('GET','/empresa/'+A)).body.catalogo.map(x=>x._id).sort(),ids.slice(0,2));
  assert.equal((await call('GET','/empresa/'+B)).status,403);
  assert.equal((await call('GET','/empresa/'+A,null,'ADMIN_SEDE','')).status,403);
  assert.equal((await call('GET','/empresa/'+A,null,'EMPLEADO')).status,403);
  for(const id of [ids[0],ids[2],ids[3]]){
   assert.equal((await call('PUT','/'+id,{nombre:'no'})).status,404);
   assert.equal((await call('PUT','/'+id+'/desactivar',{})).status,404);
  }
  assert.equal((await call('PUT','/'+ids[1],{sedeId:T})).status,400);
  assert.equal((await call('PUT','/'+ids[1],{$set:{empresaId:B}})).status,400);
  assert.equal((await call('PUT','/'+ids[1],{nombre:'válido'})).status,200);
  assert.equal((await call('PUT','/'+ids[1]+'/desactivar',{})).status,200);
  const payload={empresaId:A,tipo:'producto',nombre:'prueba',precioVenta:1};
  assert.equal((await call('POST','/',{...payload,sedeId:T})).status,403);
  assert.equal((await call('POST','/',{...payload,sedeId:U},'DUEÑO')).status,403);
  assert.equal((await call('POST','/',payload)).body.productoServicio.sedeId,S);
  assert.equal((await call('POST','/',payload,'DUEÑO')).body.productoServicio.sedeId,null);
  assert.equal((await call('PUT','/'+ids[0],{nombre:'global'},'DUEÑO')).status,200);
  assert.equal((await call('PUT','/'+ids[3],{nombre:'no'},'DUEÑO')).status,404);
  if(real){
   const sibling=await Model.findById(ids[2]).lean(),foreign=await Model.findById(ids[3]).lean(),own=await Model.findById(ids[1]).lean();
   assert.equal(sibling.nombre,'fixture-2');assert.equal(foreign.nombre,'fixture-3');assert.equal(own.nombre,'válido');assert.equal(own.activo,false);
   assert.equal(await Model.countDocuments({empresaId:B}),1);
   assert.equal(await Model.countDocuments({empresaId:A}),5);
   console.log('GRUK_CATALOG_HTTP_MONGO_ISOLATION_OK');
  }else{assert.equal(rows[2].nombre,undefined);assert.equal(rows[3].nombre,undefined);}
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }finally{if(conn){try{if(conn.readyState===1)await conn.dropDatabase();}finally{await conn.close();}}}
});
