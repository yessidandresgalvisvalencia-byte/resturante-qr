"use strict";
// Domain-level preflight only: no sale, stock or ledger writes occur here.
// Monetary amounts are integer COP minor units, never binary floating point.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
function fail(){const e=new Error("OFFLINE_ORDER_NOT_POSTABLE");e.code="OFFLINE_ORDER_NOT_POSTABLE";throw e;}
function integer(value,min=0){
  if(typeof value!=="string"||!/^(0|[1-9][0-9]*)$/.test(value))fail();
  const n=BigInt(value);
  if(n<BigInt(min)||n>BigInt(Number.MAX_SAFE_INTEGER))fail();
  return n;
}
function validateOfflineOrderForPosting(event){
  if(!event||event.tipo!=="PEDIDO_REGISTRADO"||!ULID.test(event.eventId||""))fail();
  const p=event.payload;
  if(!p||typeof p!=="object"||Array.isArray(p))fail();
  if(!ULID.test(p.localOrderId||"")||!Array.isArray(p.items)||p.items.length<1||p.items.length>100)fail();
  let calculated=0n;
  const items=p.items.map(item=>{
    if(!item||!SAFE.test(item.productoId||""))fail();
    const qty=integer(item.cantidad,1);
    const unit=integer(item.precioUnitarioCop);
    const line=integer(item.totalCop);
    if(qty*unit!==line)fail();
    calculated+=line;
    return Object.freeze({productoId:item.productoId,cantidad:qty.toString(),precioUnitarioCop:unit.toString(),totalCop:line.toString()});
  });
  const total=integer(p.totalCop);
  if(calculated!==total||calculated>BigInt(Number.MAX_SAFE_INTEGER))fail();
  return Object.freeze({eventId:event.eventId,localOrderId:p.localOrderId,items:Object.freeze(items),totalCop:total.toString()});
}
module.exports={validateOfflineOrderForPosting};
