"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const routes=fs.readFileSync(require.resolve("../../modules/finanzas-personales/routes"),"utf8");
const ui=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
test("proximo vencimiento se basa en pagos reales y mantiene dia original",()=>{
 assert.match(routes,/mes\+pagos\.length/);
 assert.match(routes,/Math\.min\(dia,ultimoDia\)/);
 assert.match(routes,/proximoVencimiento,frecuenciaSinConfirmar/);
});
test("fecha no confirmada se rotula estimada y no se vuelve a registrar pago",()=>{
 assert.match(ui,/Próximo vencimiento estimado/);
 assert.match(ui,/confirmarFrecuenciaMensual/);
 assert.match(ui,/body:JSON\.stringify\(\{periodicidad:"MENSUAL"\}\)/);
});
