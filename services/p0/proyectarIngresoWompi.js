'use strict';
const mongoose=require('mongoose');
const Venta=require('../../models/Venta');
const Ingreso=require('../../models/GrukIngresoConfirmado');
const {crearProcesadorIdempotente}=require('./procesadorEventosIdempotente');
const OID=/^[0-9a-f]{24}$/i;
function invalid(code){return Object.assign(new Error(code),{statusCode:409});}
function crearProyectorIngresoWompi({VentaModel=Venta,IngresoModel=Ingreso,procesar=crearProcesadorIdempotente()}={}){
 return async function proyectar(evento){
  if(!evento||evento.eventName!=='VENTA_COMPLETADA'||!OID.test(String(evento.empresaId||''))||!OID.test(String(evento.aggregateId||''))||
   evento.eventId!=='VENTA_COMPLETADA:'+String(evento.aggregateId)||
   String(evento.payload?.ventaId||'')!==String(evento.aggregateId)||typeof evento.payload?.restaurantId!=='string'||!evento.payload.restaurantId.trim())throw invalid('INGRESO_EVENTO_INVALIDO');
  return procesar({empresaId:evento.empresaId,consumidor:'finanzas_wompi_p0',eventId:evento.eventId,aplicar:async({session})=>{
   const venta=await VentaModel.findOne({_id:evento.aggregateId,empresaId:evento.empresaId,origen:'restaurante',estado:'pagada',metodoPago:'tarjeta'}).session(session).lean();
   if(!venta||String(venta.metadata?.restaurantId||'')!==evento.payload.restaurantId||
      String(venta._id)!==String(evento.payload.ventaId))throw invalid('INGRESO_VENTA_NO_AUTORIZADA');
   if(typeof venta.total!=='number'||!Number.isSafeInteger(venta.total)||venta.total<=0||venta.total>Math.floor(Number.MAX_SAFE_INTEGER/100)||
      evento.payload.total!==venta.total)throw invalid('INGRESO_MONTO_NO_CONCILIADO');
   await IngresoModel.create([{empresaId:venta.empresaId,sedeId:venta.sedeId||null,ventaId:venta._id,eventId:evento.eventId,importeCentavos:venta.total*100,moneda:'COP',fuente:'WOMPI_PEDIDO'}],{session});
  }});
 };
}
module.exports={crearProyectorIngresoWompi};
