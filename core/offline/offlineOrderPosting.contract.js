"use strict";
// Domain-level preflight only: no sale, stock or ledger writes occur here.
// Monetary amounts are integer COP minor units, never binary floating point.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
function fail(){const e=new Error("OFFLINE_ORDER_NOT_POSTABLE");e.code="OFFLINE_ORDER_NOT_POSTABLE";throw e;}
function ownData(record,key){
  if(!record||typeof record!=="object"||Array.isArray(record))fail();
  const descriptor=Object.getOwnPropertyDescriptor(record,key);
  // Accessor properties can change values during validation or run side effects.
  if(!descriptor||!("value" in descriptor))fail();
  return descriptor.value;
}
function integer(value,min=0){
  if(typeof value!=="string"||value.length>16||!/^(0|[1-9][0-9]*)$/.test(value))fail();
  const n=BigInt(value);
  if(n<BigInt(min)||n>BigInt(Number.MAX_SAFE_INTEGER))fail();
  return n;
}
function validateOfflineOrderForPosting(event){
  const tipo=ownData(event,"tipo");
  const eventId=ownData(event,"eventId");
  const p=ownData(event,"payload");
  if(tipo!=="PEDIDO_REGISTRADO"||typeof eventId!=="string"||!ULID.test(eventId))fail();
  const localOrderId=ownData(p,"localOrderId");
  const itemsInput=ownData(p,"items");
  const totalInput=ownData(p,"totalCop");
  if(typeof localOrderId!=="string"||!ULID.test(localOrderId)||
     !Array.isArray(itemsInput)||itemsInput.length<1||itemsInput.length>100||
     !Array.from({length:itemsInput.length},(_,i)=>Object.hasOwn(itemsInput,i)).every(Boolean))fail();
  let calculated=0n;
  const items=itemsInput.map(item=>{
    const productoId=ownData(item,"productoId");
    const cantidad=ownData(item,"cantidad");
    const precioUnitarioCop=ownData(item,"precioUnitarioCop");
    const totalCop=ownData(item,"totalCop");
    if(typeof productoId!=="string"||!SAFE.test(productoId))fail();
    const qty=integer(cantidad,1);
    const unit=integer(precioUnitarioCop);
    const line=integer(totalCop);
    if(qty*unit!==line)fail();
    calculated+=line;
    return Object.freeze({productoId,cantidad:qty.toString(),precioUnitarioCop:unit.toString(),totalCop:line.toString()});
  });
  const total=integer(totalInput);
  if(calculated!==total||calculated>BigInt(Number.MAX_SAFE_INTEGER))fail();
  return Object.freeze({eventId,localOrderId,items:Object.freeze(items),totalCop:total.toString()});
}
module.exports={validateOfflineOrderForPosting};
