"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {inspectPurchaseReversal}=require("../../services/purchaseReversalPreflight");
const A="a".repeat(24),S="b".repeat(24),P="c".repeat(24),I="d".repeat(24),C="e".repeat(24);
const purchase={_id:C,empresaId:A,sedeId:S,estado:"registrada",estadoPago:"pendiente",saldoPendientePago:20,total:20,items:[{productoServicioId:P,cantidad:2}]};
const movement={empresaId:A,sedeId:S,referenciaTipo:"Compra",referenciaId:C,tipo:"entrada",motivo:"compra",productoServicioId:P,inventarioId:I,cantidad:2,stockAnterior:1,stockNuevo:3,costoUnitario:10};
const stock={_id:I,empresaId:A,sedeId:S,productoServicioId:P,anulado:false,cantidad:3};
function models(moves,stocks){
 const calls=[];
 const model=(name,rows)=>({find(q){calls.push([name,q]);return {limit(n){assert.equal(n,501);return {lean:async()=>rows};}};}});
 return {Movement:model("movement",moves),Inventory:model("inventory",stocks),calls};
}
test("diagnostic is read-only and never grants reversal authority",async()=>{
 const m=models([movement],[stock]);const result=await inspectPurchaseReversal(purchase,m);
 assert.equal(result.canReverse,false);assert.equal(result.readOnly,true);assert.equal(result.originalMovements,1);
 assert.deepEqual(result.issues,["FINANCIAL_REVERSAL_NOT_IMPLEMENTED","VALUATION_REVERSAL_NOT_IMPLEMENTED"]);
 assert.deepEqual(m.calls,[["movement",{empresaId:A,sedeId:S,referenciaTipo:"Compra",referenciaId:C}],["inventory",{empresaId:A,sedeId:S,_id:{$in:[I]},anulado:false}]]);
});
test("diagnostic detects missing, foreign, inconsistent and insufficient evidence",async()=>{
 for(const [moves,stocks,issue] of [[[],[],"CATALOG_MOVEMENT_UNRECONCILED"],[[{...movement,empresaId:S}],[stock],"MOVEMENT_EVIDENCE_INVALID"],[[movement],[{...stock,cantidad:1}],"STOCK_INSUFFICIENT"],[[movement],[{...stock,sedeId:A}],"STOCK_EVIDENCE_MISSING"],[[{...movement,stockNuevo:99}],[stock],"MOVEMENT_EVIDENCE_INVALID"]]){
  const result=await inspectPurchaseReversal(purchase,models(moves,stocks));assert.ok(result.issues.includes(issue));assert.equal(result.canReverse,false);
 }
 const paid=await inspectPurchaseReversal({...purchase,estadoPago:"pagado",saldoPendientePago:0},models([movement],[stock]));
 assert.ok(paid.issues.includes("PAYMENT_RECONCILIATION_REQUIRED"));
});
