"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../routes/API.js"),"utf8");
test("Webhook Wompi no confirma HTTP 200 si el pago de pedido queda sin aplicar",()=>{
 const beginning=source.indexOf('if (reference.startsWith("GRUK_PEDIDO_"))');
 const end=source.indexOf('if (!reference.startsWith("suscripcion_")',beginning);
 assert.ok(beginning>=0&&end>beginning);
 const block=source.slice(beginning,end);
 assert.match(block,/if \(!resultadoPedido\.ok\)/);
 assert.match(block,/return res\.status\(503\)\.json\(\{ ok: false, error: "PAGO_PENDIENTE_CONCILIACION" \}\)/);
 assert.match(block,/return res\.status\(200\)\.json\(\{ ok: true \}\)/);
});
