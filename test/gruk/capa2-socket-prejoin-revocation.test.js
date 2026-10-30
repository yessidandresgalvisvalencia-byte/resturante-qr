"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { joinTenantRealtimeRooms, ownerRoom, siteRoom, menuRoom } =
  require("../../core/realtime/tenantRealtime.service");

const empresaId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const sedeId = "111111111111111111111111";
const baseAuth = {
  usuarioId: "user-A", empresaId, restaurantId: "restA",
  sedeId: "site-A", rol: "EMPLEADO", identityType: "USUARIO",
  tokenVersion: 2, expiresAt: 2000
};
function socket(auth = baseAuth) {
  const joined = [];
  return { auth: { ...auth }, connected: true, joined,
    join(room) { joined.push(room); },
    disconnect() { this.connected = false; }
  };
}
function siteModel(lookup = async () => ({ _id: sedeId })) {
  return { findOne() { return { select() { return { lean: lookup }; } }; } };
}
const deps = { now: () => 1_000_000 };

test("P0-70: revocación entre handshake y lookup de sede impide suscripción", async () => {
  let checks = 0;
  const s = socket();
  const joined = await joinTenantRealtimeRooms(s, {
    ...deps, SedeModel: siteModel(), validateSession: async claims => {
      checks++;
      assert.equal(claims.sub, "user-A");
      assert.equal(claims.empresaId, empresaId);
      assert.equal(claims.identityType, "USUARIO");
      assert.equal(claims.tokenVersion, 2);
      return false;
    }
  });
  assert.equal(joined, 0);
  assert.equal(checks, 1);
  assert.deepEqual(s.joined, []);
});

test("P0-70: dueño revocado no entra al room privado ni al de menú", async () => {
  const s = socket({ ...baseAuth, rol: "DUEÑO", sedeId: null, identityType: "RESTAURANTE" });
  assert.equal(await joinTenantRealtimeRooms(s, {
    ...deps, validateSession: async () => false
  }), 0);
  assert.deepEqual(s.joined, []);
});

test("P0-70: expiración durante consulta Mongo impide entrada a rooms", async () => {
  const s = socket();
  let current = 1_000_000;
  assert.equal(await joinTenantRealtimeRooms(s, {
    now: () => current, SedeModel: siteModel(async () => {
      current = 2_000_000;
      return { _id: sedeId };
    }), validateSession: async () => true
  }), 0);
  assert.deepEqual(s.joined, []);
});

test("P0-70: desconexión durante revalidación no permite join tardío", async () => {
  const s = socket();
  assert.equal(await joinTenantRealtimeRooms(s, {
    ...deps, SedeModel: siteModel(),
    validateSession: async () => { s.disconnect(); return true; }
  }), 0);
  assert.deepEqual(s.joined, []);
});

test("P0-70: error de Mongo durante revalidación falla cerrado", async () => {
  const s = socket();
  assert.equal(await joinTenantRealtimeRooms(s, {
    ...deps, SedeModel: siteModel(),
    validateSession: async () => { throw Error("MONGO_UNAVAILABLE"); }
  }), 0);
  assert.deepEqual(s.joined, []);
});

test("P0-70: sesión válida conserva rooms correctos para sede y dueño", async () => {
  const s = socket();
  assert.equal(await joinTenantRealtimeRooms(s, {
    ...deps, SedeModel: siteModel(), validateSession: async () => true
  }), 2);
  assert.deepEqual(s.joined, [siteRoom(empresaId, sedeId), menuRoom(empresaId)]);
  const owner = socket({ ...baseAuth, rol: "DUEÑO", sedeId: null, identityType: "RESTAURANTE" });
  assert.equal(await joinTenantRealtimeRooms(owner, {
    ...deps, validateSession: async () => true
  }), 2);
  assert.deepEqual(owner.joined, [ownerRoom(empresaId), menuRoom(empresaId)]);
});

test("P0-70: sesión sin caducidad o identidad revocable no entra a rooms", async () => {
  for (const override of [
    { expiresAt: null }, { expiresAt: "2000" }, { expiresAt: 999 },
    { identityType: null }, { tokenVersion: "2" }, { usuarioId: "" }
  ]) {
    const s = socket({ ...baseAuth, ...override });
    assert.equal(await joinTenantRealtimeRooms(s, {
      ...deps, SedeModel: siteModel(), validateSession: async () => true
    }), 0, JSON.stringify(override));
    assert.deepEqual(s.joined, []);
  }
});
