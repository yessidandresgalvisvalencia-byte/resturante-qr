"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");

test("POST /api/sync/process-order enforces authenticated scope over HTTP", async () => {
  const authPath = require.resolve("../../core/auth/auth.middleware");
  const processorPath = require.resolve("../../core/offline/offlinePedidoStoredProcessor.service");
  const routePath = require.resolve("../../routes/sync");
  const saved = new Map([authPath, processorPath, routePath].map(p => [p, require.cache[p]]));
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
  const originalGetClient = mongoose.connection.getClient;
  const originalDb = mongoose.connection.db;
  const seen = [];
  let injectedError = null;
  let server;
  try {
    // Isolate the HTTP boundary: auth and persistence are stubs, not JWT or Mongo E2E.
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports(req, res, next) {
      const token = req.headers.authorization;
      if (token !== "Bearer tenant-a" && token !== "Bearer tenant-b")
        return res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
      req.auth = Object.freeze({
        empresaId: token === "Bearer tenant-a" ? "507f1f77bcf86cd799439011" : "507f1f77bcf86cd799439012",
        sedeId: "site-1", usuarioId: "actor-1"
      });
      next();
    } };
    require.cache[processorPath] = { id: processorPath, filename: processorPath, loaded: true,
      exports: { async processStoredOfflinePedido(args) {
        seen.push(args);
        if (injectedError) {
          const error = new Error("injected processor failure");
          error.code = injectedError;
          throw error;
        }
        if (args.context.empresaId.endsWith("12")) {
          const error = new Error("not found"); error.code = "OFFLINE_EVENT_NOT_FOUND"; throw error;
        }
        // A compromised or regressed processor must not override HTTP safety flags.
        return { created: seen.length === 1, eventId: args.eventId, applied: true, cobrado: true, ok: false };
      } }
    };
    Object.defineProperty(mongoose.connection, "readyState", { configurable: true, value: 1 });
    Object.defineProperty(mongoose.connection, "db", { configurable: true, value: { mocked: true } });
    mongoose.connection.getClient = () => ({ mocked: true });
    delete require.cache[routePath];
    const app = express();
    app.use(express.json());
    app.use("/api/sync", require("../../routes/sync"));
    server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port + "/api/sync/process-order";
    const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    async function send(token, body) {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = token;
      const response = await fetch(base, { method: "POST", headers, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
    }
    const unauthenticated = await send(null, { eventId });
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.cache, "no-store");
    assert.equal(seen.length, 0);
    const invalid = await send("Bearer tenant-a", { eventId: "invalid" });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.cache, "no-store");
    assert.equal(seen.length, 0);
    const first = await send("Bearer tenant-a", {
      eventId, empresaId: "507f1f77bcf86cd799439012", sedeId: "other", actorId: "attacker"
    });
    assert.equal(first.status, 202);
    assert.equal(first.body.ok, true);
    assert.equal(first.body.applied, false);
    assert.equal(first.body.cobrado, false);
    assert.equal(first.cache, "no-store");
    assert.deepEqual(seen[0].context, {
      empresaId: "507f1f77bcf86cd799439011", sedeId: "site-1", actorId: "actor-1"
    });
    const retry = await send("Bearer tenant-a", { eventId });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.created, false);
    assert.equal(retry.body.applied, false);
    assert.equal(retry.body.cobrado, false);
    assert.equal(retry.body.ok, true);
    const otherTenant = await send("Bearer tenant-b", { eventId });
    assert.equal(otherTenant.status, 404);
    assert.equal(seen.length, 3);
    // HTTP error contracts: never claim an offline order was applied.
    for (const [code, expectedStatus] of [
      ["OFFLINE_TRANSACTION_UNAVAILABLE", 503],
      ["OFFLINE_TRANSACTION_REQUIRED", 503],
      ["OFFLINE_INVALID_IDS", 400],
      ["OFFLINE_EVENT_CONFLICT", 409],
      ["OFFLINE_AUTH_REQUIRED", 403]
    ]) {
      injectedError = code;
      const failure = await send("Bearer tenant-a", { eventId });
      assert.equal(failure.status, expectedStatus, code);
      assert.equal(failure.cache, "no-store", code);
      assert.equal(failure.body.ok, false, code);
      if (expectedStatus === 503 || expectedStatus === 409) assert.equal(failure.body.applied, false, code);
      assert.equal(failure.body.error, code);
      if (expectedStatus === 503) assert.equal(failure.body.retryable, true);
    }
    injectedError = null;
    Object.defineProperty(mongoose.connection, "readyState", { configurable: true, value: 0 });
    const unavailable = await send("Bearer tenant-a", { eventId });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.cache, "no-store");
    assert.equal(unavailable.body.error, "OFFLINE_DB_UNAVAILABLE");
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [path, entry] of saved) {
      if (entry) require.cache[path] = entry;
      else delete require.cache[path];
    }
    if (originalReadyState) Object.defineProperty(mongoose.connection, "readyState", originalReadyState);
    else delete mongoose.connection.readyState;
    if (originalDb) Object.defineProperty(mongoose.connection, "db", { configurable: true, value: originalDb });
    else delete mongoose.connection.db;
    mongoose.connection.getClient = originalGetClient;
  }
});
