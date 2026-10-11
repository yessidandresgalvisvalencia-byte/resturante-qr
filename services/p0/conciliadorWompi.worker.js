'use strict';
const {randomUUID}=require('node:crypto');
const Intento=require('../../models/IntentoPagoPedido');
const {crearConciliadorWompi}=require('./conciliarPendientesWompi');
const {isP0PedidoEnabled}=require('./pedidoFeatureFlag');

function habilitado(env=process.env){
 return env.NODE_ENV!=='production'&&env.GRUK_P0_PEDIDOS_ENABLED==='true'&&
  env.GRUK_P0_WOMPI_RECONCILER_ENABLED==='true'&&
  Boolean(String(env.GRUK_P0_PEDIDOS_RESTAURANTES||'').trim());
}
function iniciarConciliadorWompi({
 env=process.env,intervalMs=60000,limit=20,
 conciliar=crearConciliadorWompi(),IntentoModel=Intento,
 onError=(error)=>console.error('[GRUK P0 RECONCILIADOR]',error)
}={}){
 if(!habilitado(env))return {started:false,stop(){}};
 if(!Number.isSafeInteger(intervalMs)||intervalMs<15000||intervalMs>3600000)throw Error('CONCILIACION_INTERVALO_INVALIDO');
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('CONCILIACION_LIMITE_INVALIDO');
 const allowed=[...new Set(String(env.GRUK_P0_PEDIDOS_RESTAURANTES).split(',').map(x=>x.trim()).filter(Boolean))];
 const workerId=randomUUID();
 let stopped=false,busy=false;
 async function tick(){
  if(stopped||busy)return;
  busy=true;
  try{
   for(const restaurantId of allowed){
    if(stopped)break;
    if(!isP0PedidoEnabled({env,restaurantId}))continue;
    // A bounded scan and in-process mutex prevent overlapping ticks. Settlement remains idempotent across hosts.
    await conciliar({restaurantId,limit});
   }
  }catch(error){onError(Object.assign(error,{workerId}));}
  finally{busy=false;}
 }
 const timer=setInterval(()=>{void tick()},intervalMs);
 timer.unref?.();
 void tick();
 return {started:true,stop(){stopped=true;clearInterval(timer);}};
}
module.exports={iniciarConciliadorWompi,habilitado};
