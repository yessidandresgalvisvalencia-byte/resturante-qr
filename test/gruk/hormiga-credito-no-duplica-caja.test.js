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
 assert.equal(r.movimientosCreditoSemana,2);assert.equal(r.movimientosSemana,1);
 assert.equal(esHormiga(rows[0]),false);assert.equal(esHormigaCredito(rows[0]),true);
});
test("pagar la tarjeta no duplica el consumo y no cuenta como café",()=>{
 const r=resumir([gasto("c1","Rappi",25000,"CREDITO"),gasto("pago","Pago tarjeta de crédito",25000,"DEBITO","PAGO_DEUDA")],ahora);
 assert.equal(r.creditoMesMinor,25000);assert.equal(r.mesMinor,0);
});
test("las fechas y duplicados contradictorios a crédito también bloquean cifras incompletas",()=>{
 assert.throws(()=>resumir([gasto("c1","Rappi",25000,"CREDITO"),gasto("c1","Rappi",26000,"CREDITO")],ahora),/INTEGRIDAD_HORMIGA/);
 assert.throws(()=>resumir([{...gasto("c2","Rappi",10000,"CREDITO"),fecha:"invalida"}],ahora),/Fecha hormiga inválida/);
});
test("el servicio consulta únicamente el usuario autenticado y conserva la explicación",()=>{
 const s=fs.readFileSync(path.resolve(__dirname,"../../modules/finanzas-personales/services/gastosHormigaResumen.service.js"),"utf8");
 const j=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
 assert.match(s,/Transaccion\.find\(\{usuarioId,tipo:"GASTO"/);
 assert.doesNotMatch(s,/medioPago:\{\$ne:"CREDITO"\}/);
 assert.match(j,/Crédito no es salida de caja hoy/);
});
