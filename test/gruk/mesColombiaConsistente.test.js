"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const s=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/finanzasPersonales.service"),"utf8");
test("mes de Colombia",()=>assert.match(s,/const inicio=monthStart\(now\),fin=nextMonth\(now\)/));
test("pagos vinculados a deuda",()=>assert.match(s,/pagosPorDeuda\.get\(String\(deuda\._id\)\)/));
