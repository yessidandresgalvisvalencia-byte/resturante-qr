"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { guardRealtimeSession, RECHECK_MS } =
  require("../../core/realtime/socketSessionLifecycle.service");
const { joinTenantRealtimeRooms } =
  require("../../core/realtime/tenantRealtime.service");

function harness(overrides = {}, checkSession = async () => true) {
  let current = 1_000_000;
  const timeouts = [];
  const intervals = [];
  const listeners = new Map();
  let disconnected = 0;
  const socket = {
    connected: true,
    auth: {
      usuarioId: "userA", empresaId: "tenantA", sedeId: "siteA",
      restaurantId: "restA", rol: "EMPLEADO",
      identityType: "USUARIO", tokenVersion: 2, expiresAt: 1010,
      ...overrides
    },
    once(event, fn) { listeners.set(event, fn); },
    off(event, fn) { if (listeners.get(event) === fn) listeners.delete(event); },
    disconnect(force) {
      assert.equal(force, true);
      disconnected++;
      this.connected = false;
      listeners.get("disconnect")?.();
    }
  };
  const timers = {
    now: () => current,
    setTimeoutFn(fn, ms) {
      const timer = { fn, ms, cleared: false };
      timeouts.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) { timer.cleared = true; },
    setIntervalFn(fn, ms) {
      const timer = { fn, ms, cleared: false };
      intervals.push(timer);
      return timer;
    },
    clearIntervalFn(timer) { timer.cleared = true; },
    checkSession
  };
  return {
    socket, timers, timeouts, intervals, listeners,
    setNow(ms) { current = ms; },
    disconnectCount() { return disconnected; }
  };
}

test("P0-70: socket caduca en tiempo real y limpia ambos timers", () => {
  const h = harness();
  guardRealtimeSession(h.socket, h.timers);
  assert.equal(h.timeouts.length, 1);
  assert.equal(h.timeouts[0].ms, 10_000);
  assert.equal(h.intervals[0].ms, RECHECK_MS);
  h.setNow(1_010_000);
  h.timeouts[0].fn();
  assert.equal(h.disconnectCount(), 1);
  assert.equal(h.timeouts[0].cleared, true);
  assert.equal(h.intervals[0].cleared, true);
  assert.equal(h.listeners.has("disconnect"), false);
});

test("P0-70: tokenVersion revocado desconecta socket activo", async () => {
  let checked = null;
  const h = harness({}, async payload => {
    checked = payload;
    return false;
  });
  guardRealtimeSession(h.socket, h.timers);
  await h.intervals[0].fn();
  assert.equal(checked.sub, "userA");
  assert.equal(checked.identityType, "USUARIO");
  assert.equal(checked.tokenVersion, 2);
  assert.equal(h.disconnectCount(), 1);
  assert.equal(h.intervals[0].cleared, true);
});

test("P0-70: falla cerrada ante caída de MongoDB durante revalidación", async () => {
  const h = harness({}, async () => { throw Error("MONGO_UNAVAILABLE"); });
  guardRealtimeSession(h.socket, h.timers);
  await h.intervals[0].fn();
  assert.equal(h.disconnectCount(), 1);
});

test("P0-70: evita revalidaciones concurrentes y limpia al desconectar", async () => {
  let release;
  let checks = 0;
  const h = harness({}, async () => {
    checks++;
    await new Promise(resolve => { release = resolve; });
    return true;
  });
  const cleanup = guardRealtimeSession(h.socket, h.timers);
  const first = h.intervals[0].fn();
  await h.intervals[0].fn();
  assert.equal(checks, 1);
  release();
  await first;
  cleanup();
  assert.equal(h.timeouts[0].cleared, true);
  assert.equal(h.intervals[0].cleared, true);
  assert.equal(h.disconnectCount(), 0);
});

test("P0-70: rechaza sockets sin caducidad segura", () => {
  for (const expiresAt of [undefined, null, 999, Number.MAX_SAFE_INTEGER, "1010"]) {
    const h = harness({ expiresAt });
    guardRealtimeSession(h.socket, h.timers);
    assert.equal(h.disconnectCount(), 1, String(expiresAt));
    assert.equal(h.timeouts.length, 0);
    assert.equal(h.intervals.length, 0);
  }
});

test("P0-70: no incorpora a rooms tras desconexión durante lookup MongoDB", async () => {
  let resolveLookup;
  const pending = new Promise(resolve => { resolveLookup = resolve; });
  const rooms = [];
  const socket = {
    connected: true,
    auth: { empresaId: "tenantA", sedeId: "siteA", restaurantId: "restA", rol: "EMPLEADO" },
    join(room) { rooms.push(room); }
  };
  const SedeModel = {
    findOne() { return { select() { return { lean: () => pending }; } }; }
  };
  const join = joinTenantRealtimeRooms(socket, { SedeModel });
  socket.connected = false;
  resolveLookup({ _id: "111111111111111111111111" });
  assert.equal(await join, 0);
  assert.deepEqual(rooms, []);
});

test("P0-70: app activa guard tras autenticación y antes de suscribir rooms", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  const guard = app.indexOf("guardRealtimeSession(socket);");
  const join = app.indexOf("joinTenantRealtimeRooms(socket)");
  assert.ok(guard >= 0 && join > guard);
});
