"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Usuario = require("../../models/usuario");
const { validarVersionSesion } = require("../../core/auth/sessionVersion.service");
const { revocarIdentidad } = require("../../core/auth/sessionRevocation.service");

const payload = { sub: "507f1f77bcf86cd799439011", identityType: "USUARIO", tokenVersion: 4 };

test("P0-70: usuarios activos requieren tokenVersion exacta; inactivos se rechazan", async () => {
  const previous = Usuario.findById;
  let row = { tokenVersion: 4, estado: "activo" };
  Usuario.findById = id => {
    assert.equal(id, payload.sub);
    return { select(fields) {
      assert.match(fields, /tokenVersion/);
      assert.match(fields, /estado/);
      return { lean: async () => row };
    } };
  };
  try {
    assert.equal(await validarVersionSesion(payload), true);
    assert.equal(await validarVersionSesion({ ...payload, tokenVersion: 3 }), false);
    row = { tokenVersion: 4, estado: "inactivo" };
    assert.equal(await validarVersionSesion(payload), false);
    row = null;
    assert.equal(await validarVersionSesion(payload), false);
  } finally {
    Usuario.findById = previous;
  }
});

test("P0-70: revocar todas las sesiones de Usuario incrementa versión persistida", async () => {
  const previous = Usuario.updateOne;
  let update;
  Usuario.updateOne = async (filter, mutation) => {
    update = { filter, mutation };
    return { matchedCount: 1 };
  };
  try {
    assert.equal(await revocarIdentidad({
      identityType: "USUARIO", usuarioId: payload.sub
    }), true);
    assert.deepEqual(update, {
      filter: { _id: payload.sub },
      mutation: { $inc: { tokenVersion: 1 } }
    });
  } finally {
    Usuario.updateOne = previous;
  }
});

test("P0-70: login Usuario emite identidad revocable y modelo incluye versión", () => {
  assert.ok(Usuario.schema.path("tokenVersion"));
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  const login = api.slice(api.indexOf('router.post("/usuarios/login"'), api.indexOf('router.delete("/debug/limpiar-registro"'));
  assert.match(login, /identityType:\s*"USUARIO"/);
  assert.match(login, /tokenVersion:\s*Number\(user\.tokenVersion \|\| 0\)/);
});
