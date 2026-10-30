"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { issueToken, resolveMesaQrRead } = require("../../core/security/qrMesaRead.service");

const secret = "a".repeat(48);
const e = "aaaaaaaaaaaaaaaaaaaaaaaa";
const other = "bbbbbbbbbbbbbbbbbbbbbbbb";
const site = "cccccccccccccccccccccccc";
const restaurantId = "tenant-restaurant";
const now = () => 1793350000000;
function mockFind(doc) {
  return { findOne: () => ({ select: () => ({ lean: async () => doc }) }) };
}
test("QR table read always scopes MongoDB query to signed enterprise, even for site-less legacy orders", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant" })
  });
  assert.equal(scope.status, 200);
  assert.equal(scope.filter.empresaId, e);
  const records = [
    { empresaId: e, restaurantId, mesa: 4, sedeId: "" },
    { empresaId: other, restaurantId, mesa: 4, sedeId: "" },
    { restaurantId, mesa: 4, sedeId: "" }
  ];
  assert.deepEqual(records.filter(r => r.empresaId === scope.filter.empresaId), [records[0]]);
});
test("QR site aliases remain enterprise scoped", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", sedeId: "local", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant" }),
    SedeModel: mockFind({ _id: site, codigoSede: "local" })
  });
  assert.equal(scope.status, 200);
  assert.equal(scope.filter.empresaId, e);
  assert.deepEqual(scope.filter.sedeId.$in, [site, "local"]);
});
test("QR from another restaurant is denied before reading orders", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId: "other", mesa: "4", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant" })
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});
