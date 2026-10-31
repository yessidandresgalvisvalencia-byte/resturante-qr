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

test("QR read verifies tenant-scoped restaurant query before exposing a filter", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  let queried;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", qrToken: token }, {
    secret, now, RestauranteModel: {
      findOne(query) {
        queried = query;
        return { select: () => ({ lean: async () => null }) };
      }
    }
  });
  assert.deepEqual(queried, { restaurantId, empresaId: e });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});
test("QR read rejects missing site and constrains site lookup by enterprise and restaurant", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  let queried;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant" }),
    SedeModel: {
      findOne(query) {
        queried = query;
        return { select: () => ({ lean: async () => null }) };
      }
    }
  });
  assert.deepEqual(queried, { _id: site, empresaId: e, restauranteId: restaurantId });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});

test("QR with a valid signature from tenant B cannot read tenant A's restaurant", async () => {
  const token = issueToken({ empresaId: other, restaurantId, mesa: 4 }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", qrToken: token }, {
    secret, now,
    RestauranteModel: {
      findOne(query) {
        assert.deepEqual(query, { restaurantId, empresaId: other });
        return { select: () => ({ lean: async () => null }) };
      }
    }
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});

test("QR with a valid signature from tenant B cannot read tenant A's site", async () => {
  const token = issueToken({ empresaId: other, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: "4", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant-B" }),
    SedeModel: {
      findOne(query) {
        assert.deepEqual(query, { _id: site, empresaId: other, restauranteId: restaurantId });
        return { select: () => ({ lean: async () => null }) };
      }
    }
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});

test("QR site query excludes cross-tenant and unowned historical orders despite matching site alias", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "local", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant-A" }),
    SedeModel: mockFind({ _id: site, codigoSede: "local" })
  });
  assert.equal(scope.status, 200);
  const records = [
    { empresaId: e, restaurantId, mesa: 4, sedeId: "local" },
    { empresaId: other, restaurantId, mesa: 4, sedeId: "local" },
    { restaurantId, mesa: 4, sedeId: "local" },
    { empresaId: e, restaurantId, mesa: 4, sedeId: "unrelated" }
  ];
  const matched = records.filter(record =>
    record.empresaId === scope.filter.empresaId &&
    record.restaurantId === scope.filter.restaurantId &&
    record.mesa === scope.filter.mesa &&
    scope.filter.sedeId.$in.includes(record.sedeId)
  );
  assert.deepEqual(matched, [records[0]]);
});

test("QR site-less query rejects a site-scoped request without leaking its filter", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: site, qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant-A" })
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});

test("tampered QR capability is rejected before any database lookup", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  const [payload, signature] = token.split(".");
  const corrupted = payload + "." + (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  let reads = 0;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken: corrupted }, {
    secret, now, RestauranteModel: { findOne() { reads++; throw Error("unexpected DB access"); } }
  });
  assert.equal(scope.status, 401);
  assert.equal(scope.filter, undefined);
  assert.equal(reads, 0);
});

test("expired QR capability is rejected before any database lookup", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  let reads = 0;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken: token }, {
    secret, now: () => now() + 91 * 24 * 60 * 60 * 1000,
    RestauranteModel: { findOne() { reads++; throw Error("unexpected DB access"); } }
  });
  assert.equal(scope.status, 401);
  assert.equal(scope.filter, undefined);
  assert.equal(reads, 0);
});

test("QR for another table is denied before any restaurant or site lookup", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  let reads = 0;
  const noRead = { findOne() { reads++; throw Error("unexpected DB access"); } };
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 5, qrToken: token }, {
    secret, now, RestauranteModel: noRead, SedeModel: noRead
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
  assert.equal(reads, 0);
});

test("QR without a configured signing secret fails closed before database access", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4 }, { secret, now }).token;
  let reads = 0;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, qrToken: token }, {
    secret: "short", now,
    RestauranteModel: { findOne() { reads++; throw Error("unexpected DB access"); } }
  });
  assert.equal(scope.status, 503);
  assert.equal(scope.filter, undefined);
  assert.equal(reads, 0);
});


test("QR for site A rejects a colliding alias supplied for another site", async () => {
  const token = issueToken({ empresaId: e, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "other-local", qrToken: token }, {
    secret, now, RestauranteModel: mockFind({ _id: "restaurant-A" }),
    SedeModel: mockFind({ _id: site, codigoSede: "local" })
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
});

test("QR signed for another tenant cannot read a colliding restaurant and site alias", async () => {
  const token = issueToken({ empresaId: other, restaurantId, mesa: 4, sedeId: site }, { secret, now }).token;
  let siteReads = 0;
  const scope = await resolveMesaQrRead({ restaurantId, mesa: 4, sedeId: "local", qrToken: token }, {
    secret, now,
    RestauranteModel: {
      findOne(query) {
        assert.deepEqual(query, { restaurantId, empresaId: other });
        return { select: () => ({ lean: async () => null }) };
      }
    },
    SedeModel: { findOne() { siteReads++; throw Error("unexpected site lookup"); } }
  });
  assert.equal(scope.status, 403);
  assert.equal(scope.filter, undefined);
  assert.equal(siteReads, 0);
});

// Schema-level guardrails only: actual index existence and concurrent collisions require MongoDB integration.
test("restaurantId and site alias declare global unique indexes (not proof of deployed indexes)", () => {
  const Restaurante = require("../../models/restaurante");
  const Sede = require("../../models/sede");
  assert.equal(Restaurante.schema.path("restaurantId").options.unique, true);
  assert.equal(Sede.schema.path("codigoSede").options.unique, true);
  assert.equal(Restaurante.schema.path("empresaId").options.index, true);
  assert.equal(Sede.schema.path("empresaId").options.index, true);
  assert.equal(Sede.schema.path("restauranteId").options.index, true);
});
