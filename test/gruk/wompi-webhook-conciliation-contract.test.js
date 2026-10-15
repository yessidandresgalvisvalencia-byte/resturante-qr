"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const api=fs.readFileSync(path.join(__dirname,"../../routes/API.js"),"utf8");
const service=fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
test("Webhooks de Wompi deben conservar trazabilidad de conciliación sin confirmar fallos",()=>{
 const start=api.indexOf('if (reference.startsWith("GRUK_PEDIDO_"))');
 const end=api.indexOf('if (!reference.startsWith("suscripcion_")',start);
 const handler=api.slice(start,end);
 assert.match(handler,/reference, transactionId: String\(transactionId\), reason: resultadoPedido\.reason/);
 assert.match(handler,/return res\.status\(503\)/);
 assert.match(handler,/return res\.status\(200\)/);
});
test("La aprobación Wompi se guarda solo después de persistir ventas y Outbox",()=>{
 const start=service.indexOf("await session.withTransaction(async () => {");
 const close=service.indexOf("lockedIntento.estado = \"APROBADO\"",start);
 assert.ok(start>0&&close>start);
 assert.ok(service.indexOf("await registrarVentaDesdePedido({",start)<close);
 assert.ok(service.indexOf("await registrarVentaEnOutbox({",start)<close);
 assert.ok(service.indexOf("await pedido.save({ session });",start)<close);
});
