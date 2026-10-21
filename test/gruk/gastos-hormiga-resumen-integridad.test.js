"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resumir,esHormiga,limites}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00.000Z");
const gasto=(id,fecha,montoMinor,concepto="Rappi",extras={})=>({_id:id,fecha,tipo:"GASTO",estado:"ACTIVA",impactoCaja:true,medioPago:"DEBITO",montoMinor,concepto,categoria:"Alimentación",...extras});
test("siete días y mes Colombia no se suman ni duplican movimientos",()=>{
 const entrada=[
  gasto("a","2026-10-20T10:00:00Z",25000,"Rappi"),
  gasto("a","2026-10-20T10:00:00Z",25000,"Rappi"),
  gasto("b","2026-10-10T10:00:00Z",10000,"Juan Valdez"),
  gasto("c","2026-09-30T10:00:00Z",5000,"Pergamino")
 ];
 const r=resumir(entrada,ahora);
 assert.equal(r.semanaMinor,25000);assert.equal(r.mesMinor,35000);
 assert.equal(r.movimientosSemana,1);assert.equal(r.movimientosMes,2);
 assert.match(r.nota,/no deben sumarse/);
});
test("exclude arriendo, deudas, crédito sin caja, anulados, ingresos y egresos sin caja",()=>{
 const tx=[
  gasto("a","2026-10-20T10:00:00Z",800000,"Arriendo", {categoria:"Gastos hormiga"}),
  gasto("b","2026-10-20T10:00:00Z",25000,"Rappi",{tipo:"INGRESO"}),
  gasto("c","2026-10-20T10:00:00Z",30000,"Rappi",{estado:"ANULADA"}),
  gasto("d","2026-10-20T10:00:00Z",30000,"Rappi",{medioPago:"CREDITO"}),
  gasto("e","2026-10-20T10:00:00Z",30000,"Rappi",{impactoCaja:false}),
  gasto("f","2026-10-20T10:00:00Z",50000,"Cuota tarjeta",{categoria:"Gastos hormiga"}),
  gasto("g","2026-10-20T10:00:00Z",25000,"Mecato")
 ];
 assert.equal(resumir(tx,ahora).semanaMinor,25000);
 assert.equal(esHormiga(tx[0]),false);
});
test("cortes por zona Bogotá, no por medianoche UTC",()=>{
 const r=limites(ahora);
 assert.equal(r.inicioMes.toISOString(),"2026-10-01T05:00:00.000Z");
 assert.equal(r.inicioSiete.toISOString(),"2026-10-14T05:00:00.000Z");
 const tx=[gasto("a","2026-10-01T04:59:59Z",1000,"Rappi"),
           gasto("b","2026-10-01T05:00:00Z",2000,"Rappi")];
 assert.equal(resumir(tx,ahora).mesMinor,2000);
});
test("no calcula cifras monetarias inválidas, fuera de rango o futuras",()=>{
 assert.throws(()=>resumir([gasto("x","2026-10-20T10:00:00Z",0.1)],ahora),/Monto hormiga inválido/);
 assert.equal(resumir([gasto("x","2026-10-21T10:00:00Z",100000)],ahora).mesMinor,0);
 assert.throws(()=>resumir([gasto("a","2026-10-20T10:00:00Z",Number.MAX_SAFE_INTEGER),gasto("b","2026-10-20T11:00:00Z",1)],ahora),/rango seguro/);
});
test("fecha inválida no se omite silenciosamente como si el gasto fuera cero",()=>{
 assert.throws(()=>resumir([gasto("x","fecha-invalida",25000)],ahora),/Fecha hormiga inválida/);
 assert.throws(()=>resumir([gasto("y",null,10000)],ahora),/Fecha hormiga inválida/);
});
test("el mismo ID con distinta cifra o fecha bloquea un resumen aparentemente conciliado",()=>{
 assert.throws(()=>resumir([
  gasto("mismo","2026-10-20T10:00:00Z",25000),
  gasto("mismo","2026-10-20T10:00:00Z",35000)
 ],ahora),/INTEGRIDAD_HORMIGA/);
 assert.throws(()=>resumir([
  gasto("mismo","2026-10-20T10:00:00Z",25000),
  gasto("mismo","2026-10-19T10:00:00Z",25000)
 ],ahora),/INTEGRIDAD_HORMIGA/);
});
test("repetición exacta del mismo movimiento se cuenta solo una vez",()=>{
 const repetido=gasto("repetido","2026-10-20T10:00:00Z",12500);
 const r=resumir([repetido,{...repetido}],ahora);
 assert.equal(r.semanaMinor,12500);
 assert.equal(r.mesMinor,12500);
 assert.equal(r.movimientosSemana,1);
});
test("API de lectura filtra exclusivamente por JWT y frontend descarta sesión anterior",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const root=path.join(__dirname,"../..");
 const routes=fs.readFileSync(path.join(root,"modules/finanzas-personales/routes.js"),"utf8");
 const js=fs.readFileSync(path.join(root,"public/finanzas-personales.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"public/finanzas-personales.html"),"utf8");
 const start=routes.indexOf('router.get("/gastos/hormiga/resumen"');
 assert.ok(start>routes.indexOf("router.use(auth,entitlement)"));
 assert.match(routes.slice(start,start+400),/obtener\(req\.personalAuth\.userId\)/);
 assert.match(js,/api\("\/gastos\/hormiga\/resumen"\)/);
 assert.match(js,/if\(token!==tokenAlInicio\|\|!tokenAlInicio\|\|\$\("app"\)\.hidden\)return/);
 assert.match(html,/id="hormigaResumen"/);
});

test("límites Colombia: semana cruza fin de mes sin perder octubre al iniciar noviembre",()=>{
 const inicioNoviembre=new Date("2026-11-01T05:15:00Z");
 const rango=limites(inicioNoviembre);
 assert.equal(rango.inicioSiete.toISOString(),"2026-10-26T05:00:00.000Z");
 assert.equal(rango.inicioMes.toISOString(),"2026-11-01T05:00:00.000Z");
 assert.equal(rango.inicioConsulta.toISOString(),"2026-10-26T05:00:00.000Z");
 const filas=[
  gasto("oct","2026-10-31T23:59:00Z",7000),
  gasto("nov","2026-11-01T05:00:00Z",8000),
  gasto("fut","2026-11-01T05:16:00Z",9000)
 ];
 const r=resumir(filas,inicioNoviembre);
 assert.equal(r.semanaMinor,15000);
 assert.equal(r.mesMinor,8000);
});
test("cortes de siete días por medianoche Bogotá son inclusivos y exactos",()=>{
 const filas=[
  gasto("antes","2026-10-14T04:59:59.999Z",1000),
  gasto("justo","2026-10-14T05:00:00.000Z",2000),
  gasto("después","2026-10-14T05:00:00.001Z",3000)
 ];
 assert.equal(resumir(filas,ahora).semanaMinor,5000);
});
test("los ID vacíos o solo espacios nunca producen sumas aparentemente confiables",()=>{
 for(const _id of [null,undefined,""," ","  ","[object Object]"]){
  assert.throws(()=>resumir([gasto(_id,"2026-10-20T10:00:00Z",1500)],ahora),/INTEGRIDAD_HORMIGA: movimiento sin identificador/);
 }
});

test("un mismo ID activo y anulado bloquea el resumen en ambos órdenes",()=>{
 const activa=gasto("mismo","2026-10-20T10:00:00Z",25000,"Rappi");
 const anulada={...activa,estado:"ANULADA"};
 for(const filas of [[activa,anulada],[anulada,activa]]){
  assert.throws(()=>resumir(filas,ahora),/INTEGRIDAD_HORMIGA: mismo movimiento con estados contradictorios/);
 }
 assert.equal(resumir([anulada],ahora).semanaMinor,0);
 assert.equal(resumir([activa],ahora).semanaMinor,25000);
});
test("una anulación contradictoria no se oculta por una clasificación no hormiga",()=>{
 const gastoActivo=gasto("conflicto","2026-10-20T10:00:00Z",25000,"Rappi");
 const anulada={...gastoActivo,estado:"ANULADA",concepto:"Arriendo"};
 assert.throws(()=>resumir([anulada,gastoActivo],ahora),/estados contradictorios/);
});
