"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearEvento,verificarCadena}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");
const {proyectarLedger}=require("../../modules/finanzas-personales/services/proyeccionLedgerV81.service");
const base={userId:"usuario-1",fechaContable:"2026-10-17",timestamp:"2026-10-17T14:00:00-05:00"};
function historial(){
 const ingreso=crearEvento({...base,id:"e1",tipo:"INGRESO",montoCentavos:10000000n,version:1});
 const gasto=crearEvento({...base,id:"e2",tipo:"GASTO",montoCentavos:2500000n,version:2},ingreso.hashActual);
 const correccion=crearEvento({...base,id:"e3",tipo:"CORRECCION",montoCentavos:1500000n,corrigeId:"e2",motivo:"Digitación",tipoCorregido:"GASTO",version:3},gasto.hashActual);
 return [ingreso,gasto,correccion];
}
test("cadena y proyección concilian después de una corrección",()=>{
 const eventos=historial();
 assert.equal(verificarCadena(eventos,eventos[2].hashActual),true);
 assert.equal(proyectarLedger(eventos,"usuario-1").saldoCentavos,8500000n);
});
test("truncar el último evento no supera auditoría anclada",()=>{
 const eventos=historial();
 assert.equal(verificarCadena(eventos.slice(0,2),eventos[2].hashActual),false);
});
test("un evento de otro usuario no puede contaminar el saldo",()=>{
 const eventos=historial();
 assert.throws(()=>proyectarLedger([...eventos,{...eventos[0],id:"e4",userId:"otro"}],"usuario-1"),TypeError);
});
