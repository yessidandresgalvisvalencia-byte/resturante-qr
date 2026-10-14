'use strict';
const {randomUUID}=require('node:crypto');
const {publicarLote}=require('./outbox.service');
function habilitado(env=process.env){
 return env.NODE_ENV!=='production'&&env.GRUK_P0_OUTBOX_WORKER_ENABLED==='true'&&env.GRUK_P0_PEDIDOS_ENABLED==='true';
}
function iniciarOutboxWorker({io,env=process.env,intervalMs=5000,onError=(err)=>console.error('[GRUK P0 OUTBOX]',err)}={}){
 if(!habilitado(env))return {started:false,stop(){}};
 if(!io||typeof io.to!=='function')throw new Error('OUTBOX_SOCKET_INVALIDO');
 if(!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>60000)throw new Error('OUTBOX_INTERVALO_INVALIDO');
 const workerId=randomUUID();let stopped=false,busy=false;
 async function tick(){
  if(stopped||busy)return;
  busy=true;
  try{await publicarLote({io,workerId,limit:50});}
  catch(error){onError(error);}
  finally{busy=false;}
 }
 const handle=setInterval(()=>{void tick()},intervalMs);
 handle.unref?.();
 void tick();
 return {started:true,stop(){stopped=true;clearInterval(handle);}};
}
module.exports={iniciarOutboxWorker,habilitado};
