'use strict';
function calcularImportePagoCentavos(pedidos){
 if(!Array.isArray(pedidos)||pedidos.length===0)throw Object.assign(new Error('PEDIDOS_INVALIDOS'),{statusCode:409});
 let centavos=0;
 for(const pedido of pedidos){
  const precio=pedido?.precio;
  if(typeof precio!=='number'||!Number.isSafeInteger(precio)||precio<=0||precio>Math.floor(Number.MAX_SAFE_INTEGER/100))throw Object.assign(new Error('PRECIO_PEDIDO_INVALIDO'),{statusCode:409});
  const subtotal=precio*100;
  if(!Number.isSafeInteger(centavos+subtotal))throw Object.assign(new Error('TOTAL_PAGO_INVALIDO'),{statusCode:409});
  centavos+=subtotal;
 }
 return centavos;
}
module.exports={calcularImportePagoCentavos};
