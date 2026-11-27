"use strict";
const mongoose=require("mongoose");
const id=v=>v!=null&&mongoose.isObjectIdOrHexString(String(v));
const same=(a,b)=>a==null?b==null:b!=null&&String(a)===String(b);
const finite=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0;
const LIMIT=500;
async function inspectPurchaseReversal(purchase,{Movement,Inventory}){
 if(!id(purchase?._id)||!id(purchase.empresaId)||(purchase.sedeId!=null&&!id(purchase.sedeId)))throw Error("INVALID_PURCHASE_SCOPE");
 const scope={empresaId:purchase.empresaId,sedeId:purchase.sedeId??null};
 const issues=new Set(["FINANCIAL_REVERSAL_NOT_IMPLEMENTED","VALUATION_REVERSAL_NOT_IMPLEMENTED"]);
 if(purchase.estado!=="registrada")issues.add("PURCHASE_NOT_ACTIVE");
 if(!finite(purchase.total)||!finite(purchase.saldoPendientePago)||purchase.saldoPendientePago>purchase.total)issues.add("PAYMENT_EVIDENCE_INCOMPLETE");
 if(purchase.estadoPago!=="pendiente"||purchase.saldoPendientePago!==purchase.total)issues.add("PAYMENT_RECONCILIATION_REQUIRED");
 const items=purchase.items;
 if(!Array.isArray(items)||!items.length||items.length>LIMIT)return {readOnly:true,canReverse:false,issues:[...issues,"ITEM_EVIDENCE_INCOMPLETE"],originalMovements:0};
 const expected=new Map();
 for(const item of items){
  if(item.productoServicioId==null)continue;
  if(!id(item.productoServicioId)||!finite(item.cantidad)||item.cantidad===0){issues.add("ITEM_EVIDENCE_INCOMPLETE");continue;}
  const key=String(item.productoServicioId);
  expected.set(key,(expected.get(key)||0)+item.cantidad);
 }
 const moves=await Movement.find({...scope,referenciaTipo:"Compra",referenciaId:purchase._id}).limit(LIMIT+1).lean();
 if(moves.length>LIMIT)return {readOnly:true,canReverse:false,issues:[...issues,"MOVEMENT_LIMIT_EXCEEDED"],originalMovements:null};
 const quantities=new Map(),byInventory=new Map();
 for(const m of moves){
  if(!same(m.empresaId,scope.empresaId)||!same(m.sedeId,scope.sedeId)||!same(m.referenciaId,purchase._id)||m.referenciaTipo!=="Compra"||m.tipo!=="entrada"||m.motivo!=="compra"||!id(m.inventarioId)||!id(m.productoServicioId)||!finite(m.cantidad)||m.cantidad===0||!finite(m.stockAnterior)||!finite(m.stockNuevo)||m.stockNuevo-m.stockAnterior!==m.cantidad||!finite(m.costoUnitario)){
   issues.add("MOVEMENT_EVIDENCE_INVALID");continue;
  }
  const p=String(m.productoServicioId),i=String(m.inventarioId);
  quantities.set(p,(quantities.get(p)||0)+m.cantidad);
  const group=byInventory.get(i)||{product:p,quantity:0};
  if(group.product!==p)issues.add("MOVEMENT_EVIDENCE_INVALID");
  group.quantity+=m.cantidad;byInventory.set(i,group);
 }
 for(const [p,q] of expected)if(quantities.get(p)!==q)issues.add("CATALOG_MOVEMENT_UNRECONCILED");
 for(const p of quantities.keys())if(!expected.has(p))issues.add("UNEXPECTED_MOVEMENT");
 const stocks=byInventory.size?await Inventory.find({...scope,_id:{$in:[...byInventory.keys()]},anulado:false}).limit(LIMIT+1).lean():[];
 const stockMap=new Map(stocks.map(x=>[String(x._id),x]));
 for(const [i,g] of byInventory){
  const stock=stockMap.get(i);
  if(!stock||!same(stock.empresaId,scope.empresaId)||!same(stock.sedeId,scope.sedeId)||!same(stock.productoServicioId,g.product)||stock.anulado!==false||!finite(stock.cantidad))issues.add("STOCK_EVIDENCE_MISSING");
  else if(stock.cantidad<g.quantity)issues.add("STOCK_INSUFFICIENT");
 }
 return {readOnly:true,canReverse:false,issues:[...issues],originalMovements:moves.length};
}
module.exports={inspectPurchaseReversal};
