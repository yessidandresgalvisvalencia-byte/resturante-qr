"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {collectColombia,SOURCES}=require("../../modules/finanzas-personales/services/macroCollector.service");
const dane="<html>En septiembre de 2026, la variación anual fue 5,10%</html>";
const ibr="<html>Indicador bancario de referencia (IBR) Overnight Tasa nominal 11,409% 16/10/2026</html>";
async function simular(paginas){
 const anterior=globalThis.fetch;
 const llamadas=[];
 globalThis.fetch=async url=>{
  llamadas.push(String(url));
  const pagina=paginas[String(url)];
  if(pagina===undefined)return{ok:false,status:503,text:async()=>""};
  return{ok:true,text:async()=>pagina};
 };
 try{return{dato:await collectColombia(),llamadas}}
 finally{globalThis.fetch=anterior}
}
test("IBR: consulta glosario oficial primero y no necesita respaldo si es verificable",async()=>{
 const {dato,llamadas}=await simular({[SOURCES.inflacion]:dane,[SOURCES.ibr]:ibr});
 assert.equal(dato.tasaLibreRiesgoPct,11.409);
 assert.equal(dato.fuenteTasa,SOURCES.ibr);
 assert.ok(!llamadas.includes(SOURCES.ibrAlternativa));
});
test("IBR: si glosario carece de dato validado, usa únicamente otra fuente oficial",async()=>{
 const {dato,llamadas}=await simular({[SOURCES.inflacion]:dane,[SOURCES.ibr]:"<html>Sin tasas</html>",[SOURCES.ibrAlternativa]:ibr});
 assert.equal(dato.tasaLibreRiesgoPct,11.409);
 assert.equal(dato.fuenteTasa,SOURCES.ibrAlternativa);
 assert.ok(llamadas.includes(SOURCES.ibrAlternativa));
 assert.equal(dato.fechaCorte.toISOString(),"2026-09-30T00:00:00.000Z");
});
test("IBR: dos fuentes oficiales sin tasa nunca generan valor supuesto",async()=>{
 const anterior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,text:async()=>String(url).includes("dane.gov.co")?dane:"<html>Contenido sin IBR</html>"});
 try{await assert.rejects(collectColombia(),/NO_CALCULABLE: BanRep sin IBR Overnight verificable en fuentes oficiales/)}
 finally{globalThis.fetch=anterior}
});
