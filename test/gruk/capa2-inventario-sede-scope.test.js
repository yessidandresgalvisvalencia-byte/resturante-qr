"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {sedeAutorizada,prepararAlta}=require("../../core/security/inventarioSede.scope");
const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
const sedeA="507f191e810c19729de860ea",sedeB="507f191e810c19729de860eb";
test("Capa 2: ADMIN_SEDE solo ve su sede y empresa",()=>{
 const auth={rol:"ADMIN_SEDE",empresaId:A,sedeId:sedeA};
 assert.deepEqual(sedeAutorizada(auth),{empresaId:A,sedeId:sedeA});
 assert.equal(sedeAutorizada({...auth,sedeId:null}),null);
 assert.equal(sedeAutorizada({...auth,sedeId:"otro"}),null);
 assert.equal(sedeAutorizada({...auth,empresaId:null}),null);
 assert.equal(sedeAutorizada({...auth,rol:"EMPLEADO"}),null);
 assert.deepEqual(sedeAutorizada({rol:"DUEÑO",empresaId:A}),{empresaId:A});
});
test("Capa 2: alta no permite falsificar empresa ni sede",()=>{
 const auth={rol:"ADMIN_SEDE",empresaId:A,sedeId:sedeA};
 assert.equal(prepararAlta(auth,{empresaId:B,sedeId:sedeA}),null);
 assert.equal(prepararAlta(auth,{empresaId:A,sedeId:sedeB}),null);
 assert.equal(prepararAlta({...auth,sedeId:null},{nombre:"x"}),null);
 assert.deepEqual(prepararAlta(auth,{nombre:"x",sedeId:sedeA}),{nombre:"x",empresaId:A,sedeId:sedeA});
 assert.deepEqual(prepararAlta(auth,{nombre:"x"}),{nombre:"x",empresaId:A,sedeId:sedeA});
});
test("Capa 2: históricos sin sede solo quedan disponibles al DUEÑO",()=>{
 const owner={rol:"DUEÑO",empresaId:A};
 assert.deepEqual(sedeAutorizada(owner),{empresaId:A});
 assert.deepEqual(prepararAlta(owner,{nombre:"anterior",sedeId:null}),{nombre:"anterior",sedeId:null,empresaId:A});
});
