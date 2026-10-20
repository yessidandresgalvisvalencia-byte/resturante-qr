"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {resumir,esHormiga,esHormigaCredito}=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const ahora=new Date("2026-10-20T15:00:00Z");
const gasto=(id,concepto,montoMinor,medioPago="DEBITO",tipo="GASTO")=>({_id:id,fecha:new Date("2026-10-20T10:00:00Z"),tipo,concepto,categoria:"Alimentación",montoMinor,medioPago,impactoCaja:true,estado:"ACTIVA"});
test("distingue gasto hormiga pagado a crédito de salida inmediata de caja",()=>{
 const rows=[gasto("c1","Rappi",25000,"CREDITO"),gasto("d1","Juan Valdez",10000),gasto("c2","OXXO",5000,"CREDITO")];
 const r=resumir(rows,ahora);
 assert.equal(r.semanaMinor,10000);assert.equal(r.mesMinor,10000);
 assert.equal(r.creditoSemanaMinor,30000);assert.equal(r.creditoMesMinor,30000);
 assert.equal(r.consumoTotalSemanaMinor,40000);assert.equal(r.consumoTotalMesMinor,40000);
 assert.equal(r.movimientosCreditoSemana,2);assert.equal(r.movimientosSemana,1);
 assert.equal(esHormiga(rows[0]),false);assert.equal(esHormigaCredito(rows[0]),true);
});
test("promedio diario observado divide exactamente por siete sin sumar ventanas",()=>{
 const rows=[gasto("debito","Juan Valdez",10000,"DEBITO"),gasto("credito","Rappi",25000,"CREDITO")];
 const r=resumir(rows,ahora);
 assert.equal(r.promedioDiarioCajaMinor,1428);
 assert.equal(r.promedioDiarioCreditoMinor,3571);
 assert.equal(r.promedioDiarioConsumoMinor,5000);
 assert.equal(r.consumoTotalSemanaMinor,35000);
});
test("promedio diario no inventa gastos futuros ni predicciones",()=>{
 const r=resumir([],ahora);
 assert.equal(r.promedioDiarioCajaMinor,0);
 assert.equal(r.promedioDiarioCreditoMinor,0);
 assert.equal(r.promedioDiarioConsumoMinor,0);
});
test("pagar la tarjeta no duplica el consumo y no cuenta como café",()=>{
 const r=resumir([gasto("c1","Rappi",25000,"CREDITO"),gasto("pago","Pago tarjeta de crédito",25000,"DEBITO","PAGO_DEUDA")],ahora);
 assert.equal(r.creditoMesMinor,25000);assert.equal(r.mesMinor,0);
});
test("las fechas y duplicados contradictorios a crédito también bloquean cifras incompletas",()=>{
 assert.throws(()=>resumir([gasto("c1","Rappi",25000,"CREDITO"),gasto("c1","Rappi",26000,"CREDITO")],ahora),/INTEGRIDAD_HORMIGA/);
 assert.throws(()=>resumir([{...gasto("c2","Rappi",10000,"CREDITO"),fecha:"invalida"}],ahora),/Fecha hormiga inválida/);
});
test("rechaza suma total que exceda entero seguro aunque caja y crédito sean válidos individualmente",()=>{
 const limite=Number.MAX_SAFE_INTEGER;
 const mitad=Math.floor(limite/2)+1;
 const x=gasto("d1","Rappi",mitad,"DEBITO");
 const y=gasto("c1","Rappi",mitad,"CREDITO");
 assert.throws(()=>resumir([x,y],ahora),/Consumo hormiga total excede rango monetario seguro/);
});
test("movimiento sin identificador verificable no contamina sumas ni se cuenta dos veces",()=>{
 const origen=gasto("id-valido","Rappi",18000,"CREDITO");
 for(const id of [null,undefined,"",{}]){
  assert.throws(()=>resumir([{...origen,_id:id}],ahora),/INTEGRIDAD_HORMIGA: movimiento sin identificador verificable/);
 }
 const r=resumir([origen,{...origen}],ahora);
 assert.equal(r.creditoSemanaMinor,18000);
 assert.equal(r.consumoTotalSemanaMinor,18000);
});
test("el servicio consulta únicamente el usuario autenticado y conserva la explicación",()=>{
 const s=fs.readFileSync(path.resolve(__dirname,"../../modules/finanzas-personales/services/gastosHormigaResumen.service.js"),"utf8");
 const j=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
 assert.match(s,/Transaccion\.find\(\{usuarioId,tipo:"GASTO"/);
 assert.doesNotMatch(s,/medioPago:\{\$ne:"CREDITO"\}/);
 assert.match(j,/Crédito no es salida de caja hoy/);
});

test("no inventa salida de caja para medio de pago faltante o desconocido",()=>{
 const compra=gasto("desconocido","Rappi",25000,"DEBITO");
 for(const medioPago of [null,undefined,"", "MODO_DESCONOCIDO"]){
  const tx={...compra,medioPago};
  assert.throws(()=>resumir([tx],ahora),/medio de pago desconocido/);
  assert.throws(()=>esHormiga(tx),/medio de pago desconocido/);
 }
});
test("las compras hormiga con crédito se cuentan como consumo, no como caja",()=>{
 const compra={...gasto("credito","Rappi",28000,"CREDITO"),impactoCaja:false};
 const resultado=resumir([compra],ahora);
 assert.equal(resultado.semanaMinor,0);
 assert.equal(resultado.creditoSemanaMinor,28000);
 assert.equal(resultado.consumoTotalSemanaMinor,28000);
});
test("un gasto sin impacto de caja no se vuelve salida efectiva por ser débito",()=>{
 const compra={...gasto("no-caja","Rappi",29000,"DEBITO"),impactoCaja:false};
 const resultado=resumir([compra],ahora);
 assert.equal(resultado.semanaMinor,0);
 assert.equal(resultado.creditoSemanaMinor,0);
});
