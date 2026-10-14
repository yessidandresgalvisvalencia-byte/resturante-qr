"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
test("Un intento sin aprobar no omite pedidos pagados por otra operación",()=>{
 const guard=source.indexOf('if (pedido.estadoPago === "pagado") {');
 const reject=source.indexOf('throw new Error("PEDIDO_YA_PAGADO_REQUIERE_CONCILIACION")',guard);
 const approve=source.indexOf('lockedIntento.estado = "APROBADO"',guard);
 assert.ok(guard>0&&reject>guard&&approve>reject);
 assert.doesNotMatch(source,/if \(pedido\.estadoPago === "pagado"\) continue/);
});
