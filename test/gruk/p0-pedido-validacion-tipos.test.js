'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createResolverPedidoAutorizado}=require('../../services/p0/resolverPedidoAutorizado');
const O='507f1f77bcf86cd799439011',P='507f1f77bcf86cd799439012';
function resolver(price=15000,extraPrice=2000){
 const q=(value)=>({session(){return {async lean(){return value}}}});
 return createResolverPedidoAutorizado({
  Menu:{findOne:()=>q({_id:O,restaurantId:'r',disponible:true,productoServicioId:P,nombre:'Producto',precio:price,extras:[{nombre:'Queso',precio:extraPrice}]})},
  ProductoServicio:{findOne:()=>q({_id:P,activo:true})}
 });
}
const base={restaurantId:'r',sedeId:'',empresaId:O,session:{inTransaction:()=>true},intent:{mesa:3,cantidad:2,menuItemId:O,extra:'Queso'}};
test('precio solo proviene del catálogo y no del cliente',async()=>{
 const result=await resolver()({...base,intent:{...base.intent,precio:1,precioUnitario:1,valorExtraUnitario:1}});
 assert.equal(result.precio,34000);assert.equal(result.precioUnitario,17000);
});
test('rechaza cantidad enviada como cadena',async()=>{
 await assert.rejects(resolver()({...base,intent:{...base.intent,cantidad:'2'}}),{statusCode:400});
});
test('rechaza mesa enviada como cadena',async()=>{
 await assert.rejects(resolver()({...base,intent:{...base.intent,mesa:'3'}}),{statusCode:400});
});
test('rechaza extra con tipo no textual',async()=>{
 await assert.rejects(resolver()({...base,intent:{...base.intent,extra:{nombre:'Queso'}}}),{statusCode:400});
});
test('rechaza precio del catálogo con tipo incorrecto',async()=>{
 await assert.rejects(resolver('15000')(base),{statusCode:409});
});
test('rechaza precio de extra con tipo incorrecto',async()=>{
 await assert.rejects(resolver(15000,'2000')(base),{statusCode:409});
});
