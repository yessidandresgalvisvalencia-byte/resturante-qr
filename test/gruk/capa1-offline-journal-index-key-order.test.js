"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { stageOfflineSales } = require("../../core/offline/offlineSalesStaging.service");
const { stageOfflineCashIntents } = require("../../core/offline/offlineCashStaging.service");
const { stageOfflineStockMovements } = require("../../core/offline/offlineStockStaging.service");
const { calculateOfflineStockDeltas } = require("../../core/offline/offlineInventoryDeltas.service");

const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FA0";
const productoId = "507f1f77bcf86cd799439011";
const context = { empresaId: "empresa-uno", sedeId: "sede-uno", actorId: "operador-uno" };
const plan = { orders: [{
  eventId, localOrderId: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
  totalCop: "7500", items: [{ productoId, cantidad: "2" }]
}], totalCop: "7500" };
const session = { inTransaction: () => true };
const specs = [
  {
    name: "ventas",
    collection: "gruk_offline_ventas",
    index: "uniq_offline_sale_tenant_event",
    keys: ["empresaId", "sedeId", "eventId"],
    code: "OFFLINE_SALES_UNIQUE_INDEX_REQUIRED",
    run: db => stageOfflineSales({ db, session, context, plan })
  },
  {
    name: "caja",
    collection: "gruk_offline_caja_intenciones",
    index: "uniq_offline_cash_tenant_event",
    keys: ["empresaId", "sedeId", "eventId"],
    code: "OFFLINE_CASH_UNIQUE_INDEX_REQUIRED",
    run: db => stageOfflineCashIntents({ db, session, context, plan })
  },
  {
    name: "stock",
    collection: "gruk_offline_stock_movimientos",
    index: "uniq_offline_stock_tenant_batch_product",
    keys: ["empresaId", "sedeId", "batchId", "productoId"],
    code: "OFFLINE_STOCK_UNIQUE_INDEX_REQUIRED",
    run: db => stageOfflineStockMovements({ db, session, context, plan,
      inventoryDeltas: calculateOfflineStockDeltas(plan) })
  }
];
for (const spec of specs) {
  test("diario offline " + spec.name + ": falla cerrado ante índice único en orden incorrecto", async () => {
    let writes = 0;
    const wrong = [spec.keys[2], ...spec.keys.slice(0, 2), ...spec.keys.slice(3)];
    const db = { collection(name) {
      assert.equal(name, spec.collection);
      return {
        indexes: async () => [{ name: spec.index, unique: true,
          key: Object.fromEntries(wrong.map(k => [k, 1])) }],
        updateOne: async () => { writes++; throw Error("WRITE_MUST_NOT_OCCUR"); }
      };
    } };
    await assert.rejects(spec.run(db), error => error?.code === spec.code);
    assert.equal(writes, 0);
  });
}
