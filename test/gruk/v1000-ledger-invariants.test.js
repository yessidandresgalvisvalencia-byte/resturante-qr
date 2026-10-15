"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("Ledger V1000 rechaza IP inválida antes de abrir sesión", () => {
  const code = read("services/ledgerV1000.service.js");
  const validate = code.indexOf("z.string().ip().parse(ip)");
  const session = code.indexOf("const session=await mongoose.startSession()");
  assert.ok(validate > 0 && session > validate);
});
test("Ledger V1000 conserva bloqueo de saldo y secuencia en la transacción", () => {
  const code = read("services/ledgerV1000.service.js");
  assert.match(code, /secuencia:head\.secuencia,hashUltimo:head\.hashUltimo/);
  assert.match(code, /updated\.modifiedCount!==1/);
  assert.match(code, /Movimiento\.create\(\[doc\],\{session\}\)/);
});
test("Ledger V1000 mantiene aislamiento de empresa y sede", () => {
  const code = read("models/SaldoLedgerV1000.js");
  assert.match(code, /schema\.index\(\{empresaId:1,sedeId:1\},\{unique:true\}\)/);
});
