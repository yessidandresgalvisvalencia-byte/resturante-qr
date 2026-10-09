'use strict';
function isP0PedidoEnabled({env=process.env,restaurantId}={}){
 const enabled=String(env.GRUK_P0_PEDIDOS_ENABLED||'').toLowerCase()==='true';
 // P0 is deliberately limited to non-production until the Atlas and CI gates pass.
 if(String(env.NODE_ENV||'').toLowerCase()==='production')return false;
 if(!enabled)return false;
 const allowlist=String(env.GRUK_P0_PEDIDOS_RESTAURANTES||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!restaurantId||!allowlist.length)return false;
 return allowlist.includes(String(restaurantId));
}
function requireP0IdempotencyKey(headers){
 const key=String(headers?.['idempotency-key']||'');
 if(!/^[a-zA-Z0-9_-]{16,128}$/.test(key)){
  const error=new Error('CLAVE_IDEMPOTENCIA_REQUERIDA');
  error.statusCode=428;
  throw error;
 }
 return key;
}
module.exports={isP0PedidoEnabled,requireP0IdempotencyKey};
