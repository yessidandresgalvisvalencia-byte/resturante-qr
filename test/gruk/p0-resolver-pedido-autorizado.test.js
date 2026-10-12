'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createResolverPedidoAutorizado}=require('../../services/p0/resolverPedidoAutorizado');
const empresaId='507f1f77bcf86cd799439011',menuId='507f1f77bcf86cd799439012',coreId='507f1f77bcf86cd799439013';
function resolver({menuPrice=12000,available=true,core=true}={}){
 const query=(doc)=>({session(s){assert.ok(s.inTransaction());return {async lean(){return doc;}};}});
 return createResolverPedidoAutorizado({Menu:{findOne(f){assert.equal(f.restaurantId,'piloto');assert.equal(String(f._id),menuId);return query({ _id:menuId,precio:menuPrice,productoServicioId:coreId,disponible:available,nombre:'Cafe',categoria:'bebida',extras:[{nombre:'leche',precio:2000}]});}},ProductoServicio:{findOne(f){assert.equal(String(f.empresaId),empresaId);assert.equal(f.activo,true);return query(core?{_id:coreId}:null);}}});
}
const input={restaurantId:'piloto',sedeId:'CENTRO',empresaId,intent:{menuItemId:menuId,mesa:4,cantidad:2,extra:'leche'},session:{inTransaction:()=>true}};
test('calcula precio exclusivamente desde menu y core con sesion',async()=>{const p=await resolver()(input);assert.equal(p.precio,28000);assert.equal(p.cantidad,2);assert.equal(p.productoServicioId,coreId);});
test('ignora precio economico suministrado por navegador',async()=>{const p=await resolver()({...input,intent:{...input.intent,precio:1,precioUnitario:1}});assert.equal(p.precio,28000);});
test('rechaza resolver sin transaccion',async()=>{await assert.rejects(resolver()({...input,session:{inTransaction:()=>false}}),{message:'TRANSACCION_REQUERIDA'});});
test('rechaza catalogo con producto inactivo',async()=>{await assert.rejects(resolver({available:false})(input),{message:'PRODUCTO_NO_DISPONIBLE'});});
test('rechaza producto core ajeno o inactivo',async()=>{await assert.rejects(resolver({core:false})(input),{message:'PRODUCTO_CORE_NO_AUTORIZADO'});});
test('rechaza precio no entero',async()=>{await assert.rejects(resolver({menuPrice:12000.25})(input),{message:'PRECIO_INVALIDO'});});
test('rechaza cantidad excesiva',async()=>{await assert.rejects(resolver()({...input,intent:{...input.intent,cantidad:101}}),{message:'CANTIDAD_O_MESA_INVALIDA'});});
