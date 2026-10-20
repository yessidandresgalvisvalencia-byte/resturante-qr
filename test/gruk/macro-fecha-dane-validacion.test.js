"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {collectColombia}=require("../../modules/finanzas-personales/services/macroCollector.service");

const dane="<html><body>En septiembre de 2026, la variación anual fue 5,10%</body></html>";
const banrep="<html><body>Indicador bancario de referencia (IBR) Overnight Tasa nominal 9,25% 15/09/2026</body></html>";
async function mockFetch(fn){
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,text:async()=>fn(String(url))});
 try{return await collectColombia();}
 finally{globalThis.fetch=original;}
}
test("IPC DANE acepta año válido y calcula fecha de corte sin inventar tasas",async()=>{
 const snapshot=await mockFetch(url=>url.includes("dane.gov.co")?dane:banrep);
 assert.equal(snapshot.pais,"CO");
 assert.equal(snapshot.moneda,"COP");
 assert.equal(snapshot.inflacionAnualPct,5.1);
 assert.equal(snapshot.tasaLibreRiesgoPct,9.25);
 assert.equal(snapshot.fechaCorte.toISOString(),"2026-09-15T00:00:00.000Z");
 assert.match(snapshot.metodologiaTasa,/no equivale a un rendimiento soberano/);
});
test("IBR no verificable impide construir un snapshot ficticio",async()=>{
 await assert.rejects(
  mockFetch(url=>url.includes("dane.gov.co")?dane:"<html>Sin IBR Overnight verificable</html>"),
  /NO_CALCULABLE: BanRep sin IBR Overnight verificable/
 );
});
