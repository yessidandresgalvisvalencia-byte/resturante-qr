"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("fiscal preparation requires silent event handling inside ACID session", () => {
 const source = fs.readFileSync(path.join(__dirname, "../../core/facturacion/facturacion.service.js"), "utf8");
 assert.match(source, /session=null,emitirEvento=true/);
 assert.match(source, /FACTURACION_EMISION_DIRECTA_DENTRO_TRANSACCION/);
 assert.match(source, /\.session\(session\)\.lean\(\)/);
 assert.match(source, /if\(emitirEvento\)eventBus\.emit\("FACTURA_PREPARADA"/);
 assert.match(source, /estado:\{\$nin:\["ENVIANDO","VALIDADA"\]\}/);
 assert.match(source, /upsert:true,setDefaultsOnInsert:true,session/);
});
