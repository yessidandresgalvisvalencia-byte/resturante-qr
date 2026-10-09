'use strict';
const OID=/^[0-9a-f]{24}$/i;
function reject(code,statusCode=409){throw Object.assign(new Error(code),{statusCode});}
function createResolverPedidoAutorizado({Menu,ProductoServicio}){
 if(!Menu?.findOne||!ProductoServicio?.findOne)reject('DEPENDENCIAS_CATALOGO_INVALIDAS',500);
 return async function resolverAutorizado({restaurantId,sedeId='',empresaId,intent,session}){
  if(!session?.inTransaction?.())reject('TRANSACCION_REQUERIDA',500);
  if(!OID.test(String(empresaId||''))||!OID.test(String(intent?.menuItemId||'')))reject('IDENTIDAD_INVALIDA',400);
  const mesa=Number(intent.mesa),cantidad=Number(intent.cantidad);
  if(!Number.isSafeInteger(mesa)||mesa<1||!Number.isSafeInteger(cantidad)||cantidad<1||cantidad>100)reject('CANTIDAD_O_MESA_INVALIDA',400);
  const metodoPago=String(intent.metodoPago||'efectivo');
  if(!['efectivo','transferencia','pse','tarjeta'].includes(metodoPago))reject('METODO_PAGO_INVALIDO',400);
  const menu=await Menu.findOne({_id:intent.menuItemId,restaurantId}).session(session).lean();
  if(!menu||!menu.disponible||!menu.productoServicioId)reject('PRODUCTO_NO_DISPONIBLE');
  if(intent.productoServicioId&&String(intent.productoServicioId)!==String(menu.productoServicioId))reject('PRODUCTO_CORE_NO_COINCIDE');
  const core=await ProductoServicio.findOne({_id:menu.productoServicioId,empresaId,tipo:'producto',activo:true}).session(session).lean();
  if(!core)reject('PRODUCTO_CORE_NO_AUTORIZADO',403);
  const extraSolicitado=String(intent.extra||'').trim();
  let extraNombre='',valorExtraUnitario=0;
  if(extraSolicitado&&extraSolicitado!=='Sin extra'){
   const matches=(menu.extras||[]).filter(e=>String(e.nombre||'').trim().toLowerCase()===extraSolicitado.toLowerCase());
   if(matches.length!==1)reject('EXTRA_NO_AUTORIZADO',400);
   extraNombre=String(matches[0].nombre).trim();valorExtraUnitario=Number(matches[0].precio);
  }
  const base=Number(menu.precio);
  if(!Number.isSafeInteger(base)||base<0||!Number.isSafeInteger(valorExtraUnitario)||valorExtraUnitario<0)reject('PRECIO_INVALIDO');
  const precioUnitario=base+valorExtraUnitario,precio=precioUnitario*cantidad;
  if(!Number.isSafeInteger(precio)||precio<0)reject('TOTAL_INVALIDO');
  return {restaurantId,sedeId,menuItemId:menu._id,productoServicioId:core._id,mesa,producto:String(menu.nombre||''),categoria:String(menu.categoria||''),observaciones:String(intent.observaciones||'').slice(0,1000),cantidad,precioUnitario,valorExtraUnitario,extra:extraNombre,precio,metodoPago,estado:'pendiente',estadoPago:'pendiente',tiempoEstimado:Number(menu.tiempoBase)||15};
 };
}
module.exports={createResolverPedidoAutorizado};
