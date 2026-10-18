"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {proyectarLedger}=require("../../modules/finanzas-personales/services/proyeccionLedgerV81.service");
test("Múltiples correcciones consecutivas toman únicamente el valor final sin alterar historial",()=>{
 const base={id:"m1",userId:"u",tipo:"GASTO",montoCentavos:250000n};
 const corr1={id:"c1",userId:"u",tipo:"CORRECCION",corrigeId:"m1",motivo:"Error inicial",tipoCorregido:"GASTO",montoCentavos:150000n};
 const corr2={id:"c2",userId:"u",tipo:"CORRECCION",corrigeId:"m1",motivo:"Revisión comprobante",tipoCorregido:"GASTO",montoCentavos:170000n};
 const entradas=[base,corr1,corr2];
 const antes=entradas.map(x=>({...x}));
 const r=proyectarLedger(entradas,"u");
 assert.equal(r.gastosCentavos,170000n);
 assert.equal(r.saldoCentavos,-170000n);
 assert.equal(r.movimientosActivos,1);
 assert.deepEqual(entradas,antes);
});
test("Corrección de ingreso a gasto conserva centavos exactos y anulación final elimina saldo activo",()=>{
 const ingreso={id:"m2",userId:"u",tipo:"INGRESO",montoCentavos:100n};
 const cor={id:"c3",userId:"u",tipo:"CORRECCION",corrigeId:"m2",motivo:"Clasificación incorrecta",tipoCorregido:"GASTO",montoCentavos:30n};
 const anu={id:"a3",userId:"u",tipo:"ANULACION",corrigeId:"m2",motivo:"Movimiento no realizado",montoCentavos:0n};
 const corregido=proyectarLedger([ingreso,cor],"u");
 assert.equal(corregido.ingresosCentavos,0n);assert.equal(corregido.gastosCentavos,30n);
 const final=proyectarLedger([ingreso,cor,anu],"u");
 assert.equal(final.saldoCentavos,0n);assert.equal(final.movimientosActivos,0);
});
