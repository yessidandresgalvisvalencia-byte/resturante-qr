"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertOfflineStagingIndexes } = require("../../core/offline/offlineIndexesReadiness.service");
const { stageOfflineSales } = require("../../core/offline/offlineSalesStaging.service");
const { stageOfflineCashIntents } = require("../../core/offline/offlineCashStaging.service");
const { stageOfflineStockMovements } = require("../../core/offline/offlineStockStaging.service");
const { appendOfflineLedgerEvent } = require("../../core/offline/offlineLedgerWriter.service");
const { calculateOfflineStockDeltas } = require("../../core/offline/offlineInventoryDeltas.service");

const id = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context = { empresaId:"empresa-uno", sedeId:"sede-uno", actorId:"operador-uno" };
const productoId = "507f1f77bcf86cd799439011";
const plan = { orders: [{ eventId:id, localOrderId:"01ARZ3NDEKTSV4RRFFQ69G5FA1", totalCop:"7500",
  items:[{ productoId, cantidad:"2" }] }], totalCop:"7500" };
const session = { inTransaction: () => true };
const specs = [
  ["gruk_offline_ventas","uniq_offline_sale_tenant_event",["empresaId","sedeId","eventId"],
    "OFFLINE_SALES_UNIQUE_INDEX_REQUIRED",db=>stageOfflineSales({db,session,context,plan})],
  ["gruk_offline_caja_intenciones","uniq_offline_cash_tenant_event",["empresaId","sedeId","eventId"],
    "OFFLINE_CASH_UNIQUE_INDEX_REQUIRED",db=>stageOfflineCashIntents({db,session,context,plan})],
  ["gruk_offline_stock_movimientos","uniq_offline_stock_tenant_batch_product",
    ["empresaId","sedeId","batchId","productoId"],"OFFLINE_STOCK_UNIQUE_INDEX_REQUIRED",
    db=>stageOfflineStockMovements({db,session,context,plan,inventoryDeltas:calculateOfflineStockDeltas(plan)})],
  ["gruk_ledger_movimientos","uniq_offline_ledger_event_type_tenant",
    ["empresaId","sedeId","eventId","tipo"],"OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED",
    db=>appendOfflineLedgerEvent({db,session,context,eventId:id,movement:{tipo:"VENTA_OFFLINE",montoCop:"7500"}})]
];
for(const [collection,name,keys,code,write] of specs){
  for(const [mode,extra] of [["sparse",{sparse:true}],["partial",{partialFilterExpression:{tipo:"VENTA_OFFLINE"}}]]){
    test(collection+" rejects "+mode+" unique index without writing",async()=>{
      let writes=0;
      const db={collection:actual=>{
        assert.equal(actual,collection);
        return {
          indexes:async()=>[{name,key:Object.fromEntries(keys.map(k=>[k,1])),unique:true,...extra}],
          updateOne:async()=>{writes++;throw Error("UNEXPECTED_WRITE");}
        };
      }};
      await assert.rejects(write(db),err=>err?.code===code);
      assert.equal(writes,0);
    });
  }
}
for(const [mode,extra] of [["sparse",{sparse:true}],["partial",{partialFilterExpression:{scope:"limited"}}]]){
  test("readiness rejects "+mode+" unique indexes in any journal",async()=>{
    for(const badName of specs.map(x=>x[0])){
      const db={collection:collection=>{
        const found=specs.find(s=>s[0]===collection);
        return {indexes:async()=>[{name:found[1],key:Object.fromEntries(found[2].map(k=>[k,1])),
          unique:true,...(collection===badName?extra:{})}]};
      }};
      await assert.rejects(assertOfflineStagingIndexes(db),err=>err?.code==="OFFLINE_INDEX_NOT_READY");
    }
  });
}
