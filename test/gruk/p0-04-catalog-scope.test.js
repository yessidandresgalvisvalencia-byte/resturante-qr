"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {catalogScope,resolveCatalogSite,catalogChanges}=require("../../core/auth/catalogScope");
const A="a".repeat(24),B="b".repeat(24),C="c".repeat(24);
const owner={empresaId:A,rol:"DUEÑO"},admin={empresaId:A,sedeId:B,rol:"ADMIN_SEDE"};
test("catalog owner and branch scope distinguish shared reads from writes",()=>{
 assert.deepEqual(catalogScope(owner,true),{empresaId:A});
 assert.deepEqual(catalogScope(admin,false),{empresaId:A,sedeId:{$in:[null,B]}});
 assert.deepEqual(catalogScope(admin,true),{empresaId:A,sedeId:B});
 assert.equal(catalogScope({...admin,sedeId:null},true),null);
 assert.equal(catalogScope({...admin,rol:"EMPLEADO"},false),null);
});
test("catalog creation verifies branch ownership and denies sibling assignment",async()=>{
 const calls=[];
 const Sede={findOne(q){calls.push(q);return {select(){return {lean:async()=>q._id===B?{_id:B}:null};}};}};
 assert.deepEqual(await resolveCatalogSite(admin,null,Sede),{ok:true,sedeId:B});
 assert.equal((await resolveCatalogSite(admin,C,Sede)).status,403);
 assert.equal((await resolveCatalogSite(owner,C,Sede)).status,403);
 assert.deepEqual(await resolveCatalogSite(owner,null,Sede),{ok:true,sedeId:null});
 assert.deepEqual(calls,[{_id:B,empresaId:A},{_id:C,empresaId:A}]);
});
test("catalog update denies ownership transfer and Mongo update operators",()=>{
 assert.deepEqual(catalogChanges({empresaId:C,nombre:"válido"}),{nombre:"válido"});
 for(const x of [{sedeId:C},{$set:{empresaId:C}},{"metadata.x":1},{_id:C},[]])assert.equal(catalogChanges(x),null);
});
