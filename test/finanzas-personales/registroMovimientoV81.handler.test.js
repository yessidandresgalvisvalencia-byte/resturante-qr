"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearRegistroMovimientoV81,validarSolicitudV81}=require("../../modules/finanzas-personales/services/registroMovimientoV81.handler");
const id="507f1f77bcf86cd799439011";
const body={id:"solicitud_0001",tipo:"GASTO",montoCop:"0.30",fechaContable:"2026-01-01",timestamp:"2026-01-01T12:00:00-05:00"};
function res(){return {code:200,payload:null,headers:{},status(n){this.code=n;return this;},set(k,v){this.headers[k]=v;return this;},json(x){this.payload=x;return this;}};}
test("Registro V81 conserva precisión en centavos",()=>{
 assert.equal(validarSolicitudV81(body).montoCentavos,30n);
 for(const dato of [{...body,montoCop:0.3},{...body,montoCop:"0"},{...body,montoCop:"0.001"},{...body,fechaContable:"2035-01-01"},{...body,usuarioId:id},{...body,tipo:"CORRECCION"}])assert.throws(()=>validarSolicitudV81(dato));
});
test("Registro V81 no consulta ledger sin identidad verificada",async()=>{
 let llamadas=0;const handler=crearRegistroMovimientoV81(async()=>{llamadas++;});
 const response=res();await handler({personalAuth:{userId:id},body},response);
 assert.equal(response.code,401);assert.equal(llamadas,0);
});
test("Registro V81 asigna cuenta del JWT, nunca de cliente",async()=>{
 const llamadas=[];const handler=crearRegistroMovimientoV81(async(userId,d)=>{llamadas.push([userId,d]);return {...d,version:1,hashActual:"a".repeat(64)};});
 const response=res();await handler({personalAuth:{userId:id,verificado:true},body},response);
 assert.equal(response.code,201);assert.equal(llamadas[0][0],id);assert.equal(llamadas[0][1].montoCentavos,30n);
 assert.equal(response.payload.evento.montoCentavos,"30");assert.equal(response.headers["Cache-Control"],"no-store");
});

test("Registro V81 mantiene idempotencia por cuenta en reintentos HTTP",async()=>{
 const almacen=new Map();
 const handler=crearRegistroMovimientoV81(async(userId,d)=>{
  const clave=userId+":"+d.id;
  if(almacen.has(clave)){
   const actual=almacen.get(clave);
   if(actual.montoCentavos!==d.montoCentavos||actual.tipo!==d.tipo)throw Object.assign(new Error("Clave duplicada con datos distintos"),{statusCode:409});
   return actual;
  }
  const evento={...d,version:1,hashActual:"b".repeat(64)};
  almacen.set(clave,evento);
  return evento;
 });
 const primera=res(),segunda=res();
 await handler({personalAuth:{userId:id,verificado:true},body},primera);
 await handler({personalAuth:{userId:id,verificado:true},body},segunda);
 assert.equal(primera.code,201);assert.equal(segunda.code,201);
 assert.deepEqual(primera.payload,segunda.payload);
 assert.equal(almacen.size,1);
 const conflicto=res();
 await handler({personalAuth:{userId:id,verificado:true},body:{...body,montoCop:"0.40"}},conflicto);
 assert.equal(conflicto.code,409);assert.equal(almacen.size,1);
});
test("Registro V81 aísla claves idempotentes entre dos usuarios",async()=>{
 const cuentas=[];
 const handler=crearRegistroMovimientoV81(async(userId,d)=>{
  cuentas.push(userId);
  return {...d,version:1,hashActual:"c".repeat(64)};
 });
 const segundo="507f191e810c19729de860ea";
 for(const userId of [id,segundo]){
  const response=res();
  await handler({personalAuth:{userId,verificado:true},body},response);
  assert.equal(response.code,201);
 }
 assert.deepEqual(cuentas,[id,segundo]);
});
