"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Venta = require("../../models/Venta");
const { readScopedSales } = require("../../core/finanzas/lecturaVentasPersistidasP006");
const empresaId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const sedeId = "bbbbbbbbbbbbbbbbbbbbbbbb";
test("P0-06: rejects invalid scope before any DB query", async () => {
  const original = Venta.find;
  Venta.find = () => { throw new Error("UNSCOPED_QUERY"); };
  try {
    await assert.rejects(readScopedSales({ empresaId, sedeId: "other" }), /P006_SCOPE_INVALIDO/);
    await assert.rejects(readScopedSales({ empresaId, sedeId, limit: 501 }), /P006_LIMIT_INVALIDO/);
  } finally { Venta.find = original; }
});
test("P0-06: queries only scoped sales with deterministic bounded projection", async () => {
  const original = Venta.find;
  let filter, projection, sort, limit;
  Venta.find = f => {
    filter = f;
    return {
      select(p) { projection = p; return this; },
      sort(s) { sort = s; return this; },
      limit(n) { limit = n; return this; },
      async lean() { return [{ _id: "cccccccccccccccccccccccc", empresaId, sedeId, total: 12.34, estado: "pagada" }]; }
    };
  };
  try {
    const rows = await readScopedSales({ empresaId, sedeId, limit: 2 });
    assert.equal(String(filter.empresaId), empresaId);
    assert.equal(String(filter.sedeId), sedeId);
    assert.match(projection, /total/);
    assert.deepEqual(sort, { fecha: -1, _id: -1 });
    assert.equal(limit, 2);
    assert.equal(rows[0].totalLegacy, 12.34);
    assert.equal(Object.isFrozen(rows[0]), true);
  } finally { Venta.find = original; }
});
test("P0-06: fails closed on a cross-tenant row returned by repository", async () => {
  const original = Venta.find;
  Venta.find = () => ({
    select() { return this; }, sort() { return this; }, limit() { return this; },
    async lean() { return [{ _id: "dddddddddddddddddddddddd", empresaId: "cccccccccccccccccccccccc", sedeId }]; }
  });
  try {
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_SCOPE_MISMATCH/);
  } finally { Venta.find = original; }
});

test("P0-06: rejects duplicate, malformed and over-limit repository evidence", async () => {
  const original = Venta.find;
  let rows = [];
  Venta.find = () => ({
    select() { return this; }, sort() { return this; }, limit() { return this; },
    async lean() { return rows; }
  });
  const valid = { _id: "cccccccccccccccccccccccc", empresaId, sedeId };
  try {
    rows = [valid, { ...valid }];
    await assert.rejects(readScopedSales({ empresaId, sedeId, limit: 2 }), /P006_VENTA_DUPLICADA/);
    rows = [null];
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_ROW_INVALIDA/);
    rows = [{ ...valid, _id: "invalid" }];
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_ROW_INVALIDA/);
    rows = [valid, { ...valid, _id: "dddddddddddddddddddddddd" }];
    await assert.rejects(readScopedSales({ empresaId, sedeId, limit: 1 }), /P006_RESPONSE_EXCEDE_LIMITE/);
  } finally { Venta.find = original; }
});

test("P0-06: rejects sparse, inherited and accessor-backed sale evidence", async () => {
  const original = Venta.find;
  let rows = [];
  Venta.find = () => ({
    select() { return this; }, sort() { return this; }, limit() { return this; },
    async lean() { return rows; }
  });
  const valid = { _id: "cccccccccccccccccccccccc", empresaId, sedeId };
  try {
    rows = new Array(1);
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_RESPONSE_INVALIDA/);
    rows = new Array(1);
    const inherited = { 0: valid };
    Object.setPrototypeOf(rows, inherited);
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_RESPONSE_INVALIDA/);
    let getterCalled = false;
    rows = [];
    Object.defineProperty(rows, "0", {
      configurable: true, enumerable: true,
      get() { getterCalled = true; throw new Error("UNTRUSTED_GETTER"); }
    });
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_RESPONSE_INVALIDA/);
    assert.equal(getterCalled, false);
    rows = [valid];
    const result = await readScopedSales({ empresaId, sedeId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, valid._id);
  } finally { Venta.find = original; }
});

test("P0-06: never executes accessor-backed fields in persisted sale rows", async () => {
  const original = Venta.find;
  let invoked = false;
  const row = { _id: "cccccccccccccccccccccccc", empresaId, sedeId };
  Object.defineProperty(row, "total", {
    enumerable: true,
    get() { invoked = true; throw new Error("UNTRUSTED_ROW_GETTER"); }
  });
  Venta.find = () => ({
    select() { return this; }, sort() { return this; }, limit() { return this; },
    async lean() { return [row]; }
  });
  try {
    await assert.rejects(readScopedSales({ empresaId, sedeId }), /P006_ROW_INVALIDA/);
    assert.equal(invoked, false);
  } finally { Venta.find = original; }
});
