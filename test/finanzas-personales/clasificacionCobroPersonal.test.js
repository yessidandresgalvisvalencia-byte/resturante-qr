"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),S=require("../../modules/finanzas-personales/services/clasificacionCobroPersonal.service");
test("origen persistido conocido determina ingreso o recuperación sin cálculos ni inferencias",()=>{
 assert.equal(S.tipoParaOrigen({origenCuentaPorCobrar:"TRABAJO"}),"INGRESO");assert.equal(S.tipoParaOrigen({origenCuentaPorCobrar:"PRESTAMO"}),"COBRO_PRESTAMO");
 for(const v of [null,{},[],{origenCuentaPorCobrar:"OTRO"},{origenCuentaPorCobrar:"trabajo"},{origenCuentaPorCobrar:null},{origenCuentaPorCobrar:1},Object.create({origenCuentaPorCobrar:"PRESTAMO"})])assert.throws(()=>S.tipoParaOrigen(v),e=>e.statusCode===409&&e.code==="ORIGEN_COBRO_POR_CONFIRMAR");
});
test("clasificación coincide con último posterior auditado, sin exigir saldo pasado tras pagos",()=>{
 const p={origenCuentaPorCobrar:"TRABAJO",saldoMinor:100};assert.equal(S.verificarOrigenHistorico(p,{posterior:{origenCuentaPorCobrar:"TRABAJO",saldoMinor:1000}}),"INGRESO");
 assert.throws(()=>S.verificarOrigenHistorico(p,{posterior:{origenCuentaPorCobrar:"PRESTAMO"}}),e=>e.statusCode===409);assert.throws(()=>S.verificarOrigenHistorico(p,{posterior:{}}),e=>e.statusCode===409);
 assert.equal(S.verificarOrigenHistorico(p,undefined),"INGRESO");
});

test("confirmación histórica requiere último cambio explícito de origen y posterior coincidentes",()=>{
 const p={origenCuentaPorCobrar:"TRABAJO"},e={cambios:{origenCuentaPorCobrar:"TRABAJO"},posterior:{origenCuentaPorCobrar:"TRABAJO"},hashActual:"a".repeat(64)};
 assert.equal(S.confirmacionExplicita(p,[]),null);assert.equal(S.confirmacionExplicita(p,[{cambios:{concepto:"Trabajo"},posterior:{origenCuentaPorCobrar:"TRABAJO"}}]),null);assert.equal(S.confirmacionExplicita(p,[e,{cambios:{concepto:"Otro nombre"}}]),e.hashActual);assert.equal(S.confirmacionExplicita(p,[e,{cambios:{origenCuentaPorCobrar:"PRESTAMO"},posterior:{origenCuentaPorCobrar:"PRESTAMO"}}]),null);assert.equal(S.confirmacionExplicita(p,[{...e,posterior:{origenCuentaPorCobrar:"OTRO"}}]),null);
});
