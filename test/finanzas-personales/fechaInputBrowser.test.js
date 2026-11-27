"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{fechaHoraBogotaParaInput:f}=require("./helpers/fechaInputBrowser");
test("datetime-local de ensayo conserva el segundo y omite :00 canónico sin alterar el día colombiano",()=>{
 for(const [iso,civil] of [["2026-11-19T20:59:00.000Z","2026-11-19T15:59"],["2026-11-19T20:59:01.000Z","2026-11-19T15:59:01"],["2026-11-19T03:00:00.000Z","2026-11-18T22:00"],["2026-11-19T05:00:00.000Z","2026-11-19T00:00"]]){assert.equal(f(new Date(iso)),civil);assert.equal(new Date(civil+"-05:00").toISOString(),iso);}
});
test("datetime-local de ensayo rechaza fechas inválidas y no inventa un instante",()=>{for(const v of [null,"2026-11-19",new Date(NaN)])assert.throws(()=>f(v),/inválida/);});
