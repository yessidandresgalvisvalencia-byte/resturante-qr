"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  issueCallCapability, hashCallCapability, validMesa
} = require("../../core/realtime/llamadosCapability.service");

test("P0-70: capacidad QR es aleatoria, no adivinable y solo persiste digest", () => {
  const a = issueCallCapability();
  const b = issueCallCapability();
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(a.hash, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.hash, a.token);
  assert.equal(hashCallCapability(a.token), a.hash);
  assert.notEqual(hashCallCapability(b.token), a.hash);
  for (const invalid of [null, "", {}, [], "abc", a.token + "x", "A".repeat(44)])
    assert.equal(hashCallCapability(invalid), null);
});
test("P0-70: mesa no acepta coerción de objetos, notación científica ni desbordamiento", () => {
  for (const valid of [1, "1", "500"]) assert.equal(validMesa(valid), true);
  for (const invalid of [0, "0", "01", "1e2", "-1", "1.1", true, {}, [],
    "9007199254740992", Number.MAX_SAFE_INTEGER + 1])
    assert.equal(validMesa(invalid), false);
});
test("P0-70: QR no usa ID de restaurante/mesa como único permiso para ver o cerrar llamados", () => {
  const root = path.join(__dirname, "../..");
  const api = fs.readFileSync(path.join(root, "routes/API.js"), "utf8");
  const model = fs.readFileSync(path.join(root, "models/llamado.js"), "utf8");
  const client = fs.readFileSync(path.join(root, "public/script.js"), "utf8");
  assert.match(model, /capabilityHash: \{ type: String, select: false/);
  assert.match(api, /const capability = issueCallCapability\(\)/);
  assert.match(api, /delete publico\.capabilityHash/);
  assert.match(api, /callToken: capability\.token/);
  assert.match(api, /capabilityHash: hash/);
  assert.match(api, /router\.get\("\/llamados\/mesa\/:mesa\/estado-publico"/);
  assert.match(api, /router\.put\("\/llamados\/mesa\/:mesa\/atendido-publico"/);
  assert.match(api, /Llamado\.findOne\(filter\)\.select\("estado mesa"\)\.lean\(\)/);
  assert.match(api, /\.\.\.filter, estado: \{ \$in: \["pendiente", "atendiendo"\] \}/);
  assert.match(client, /sessionStorage\.setItem\(grukCallStorageKey\(\)/);
  assert.match(client, /"X-GRUK-Call-Token": capability\.token/g);
  assert.match(client, /estado-publico\?restaurantId=/);
  assert.match(client, /atendido-publico\?restaurantId=/);
  assert.doesNotMatch(client, /fetch\(`\/api\/llamados\/mesa\/\$\{mesa\}\?/);
  assert.doesNotMatch(client, /fetch\(`\/api\/llamados\/mesa\/\$\{mesa\}\/atendido\?/);
});
