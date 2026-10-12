'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crearResolverSede}=require('../../services/p0/resolverSede');
const empresaId='507f1f77bcf86cd799439011';
function modelo(rows){
 return {find(filter){assert.equal(filter.empresaId,empresaId);assert.equal(filter.restauranteId,'yessid');return {limit(n){assert.equal(n,1);return {async lean(){return rows;}};}};}};
}
test('sin sede permanece prohibido por defecto',async()=>{
 const resolver=crearResolverSede({Sede:modelo([])});
 await assert.rejects(resolver({empresaId,restaurantId:'yessid',sedeId:''}),{codigo:'SEDE_EXPLICITA_REQUERIDA'});
});
test('permite nulo solamente en restaurante que no registra sedes y con opt-in',async()=>{
 const resolver=crearResolverSede({Sede:modelo([]),permitirSinSede:true});
 const result=await resolver({empresaId,restaurantId:'yessid',sedeId:''});
 assert.equal(result.sedeObjectId,null);assert.equal(result.sedeIdOriginal,'');
});
test('rechaza nulo si existe al menos una sede',async()=>{
 const resolver=crearResolverSede({Sede:modelo([{_id:'507f1f77bcf86cd799439012'}]),permitirSinSede:true});
 await assert.rejects(resolver({empresaId,restaurantId:'yessid',sedeId:''}),{codigo:'SEDE_EXPLICITA_REQUERIDA'});
});
test('rechaza valores ambiguos en el identificador de sede',async()=>{
 const resolver=crearResolverSede({Sede:modelo([]),permitirSinSede:true});
 await assert.rejects(resolver({empresaId,restaurantId:'yessid',sedeId:' CENTRO'}),{codigo:'IDENTIDAD_SEDE_INVALIDA'});
});
