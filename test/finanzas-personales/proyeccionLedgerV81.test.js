"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {proyectarLedger}=require("../../modules/finanzas-personales/services/proyeccionLedgerV81.service");
const gasto={id:"a",userId:"u",tipo:"GASTO",montoCentavos:2500000n};
const ingreso={id:"b",userId:"u",tipo:"INGRESO",montoCentavos:10000000n};
test("proyecta balance exacto en centavos",()=>{
 assert.deepEqual(proyectarLedger([gasto,ingreso],"u"),{ingresosCentavos:10000000n,gastosCentavos:2500000n,saldoCentavos:7500000n,movimientosActivos:2});
});
test("corrección no elimina ni modifica el evento original",()=>{
 const correccion={id:"c",userId:"u",tipo:"CORRECCION",corrigeId:"a",motivo:"Error digitación",tipoCorregido:"GASTO",montoCentavos:1500000n};
 const ledger=[gasto,ingreso,correccion];
 assert.equal(proyectarLedger(ledger,"u").saldoCentavos,8500000n);
 assert.equal(gasto.montoCentavos,2500000n);
});
test("anulación compensa el gasto, sin reescribirlo",()=>{
 const anulacion={id:"c",userId:"u",tipo:"ANULACION",corrigeId:"a",motivo:"Duplicado",montoCentavos:0n};
 assert.equal(proyectarLedger([gasto,ingreso,anulacion],"u").saldoCentavos,10000000n);
});
test("rechaza eventos ajenos, repetidos o referencias inexistentes",()=>{
 assert.throws(()=>proyectarLedger([gasto,{...ingreso,userId:"otro"}],"u"),TypeError);
 assert.throws(()=>proyectarLedger([gasto,gasto],"u"),TypeError);
 assert.throws(()=>proyectarLedger([gasto,{id:"c",userId:"u",tipo:"ANULACION",corrigeId:"otro",motivo:"x",montoCentavos:0n}],"u"),TypeError);
});
test("rechaza doble anulación y valores flotantes",()=>{
 const a={id:"c",userId:"u",tipo:"ANULACION",corrigeId:"a",motivo:"Duplicado",montoCentavos:0n};
 assert.throws(()=>proyectarLedger([gasto,a,{...a,id:"d"}],"u"),TypeError);
 assert.throws(()=>proyectarLedger([{...gasto,montoCentavos:0.1}],"u"),TypeError);
});
