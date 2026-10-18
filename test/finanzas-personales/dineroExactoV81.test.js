"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parsearCopACentavos, sumarCentavos, disponibleHoy } =
  require("../../modules/finanzas-personales/services/dineroExactoV81.service");

test("0.1 + 0.2 = 0.3 exacto en centavos", () => {
  assert.equal(sumarCentavos([parsearCopACentavos("0.1"), parsearCopACentavos("0.2")]), parsearCopACentavos("0.3"));
});
test("25 lucas son 2500000 centavos", () => {
  assert.equal(parsearCopACentavos("25000"), 2500000n);
});
test("rechaza números flotantes, negativos y más de dos decimales", () => {
  for (const x of [0.1, "-1", "1.234", "1e3", "1,000", "01"]) {
    assert.throws(() => parsearCopACentavos(x), TypeError);
  }
});
test("disponible hoy descuenta obligaciones y colchón sin floats", () => {
  assert.deepEqual(disponibleHoy({saldoCentavos: 50000000n,porVencer7dCentavos: 80000000n}),
    {disponibleCentavos: -35000000n,colchonCentavos: 5000000n});
});
test("saldo negativo no genera colchón", () => {
  assert.deepEqual(disponibleHoy({saldoCentavos: -100n,porVencer7dCentavos: 0n}),
    {disponibleCentavos: -100n,colchonCentavos: 0n});
});

test("GMF 4x1000 se reserva con BigInt exacto, redondeado arriba",()=>{
 const {reservarGmfCentavos,disponibleHoyConGmf}=
  require("../../modules/finanzas-personales/services/dineroExactoV81.service");
 assert.equal(reservarGmfCentavos(2500000n),10000n);
 assert.equal(reservarGmfCentavos(1n),1n);
 assert.equal(reservarGmfCentavos(0n),0n);
 assert.deepEqual(disponibleHoyConGmf({
  saldoCentavos:50000000n,porVencer7dCentavos:8000000n,retiroGravadoCentavos:2500000n
 }),{disponibleCentavos:36990000n,colchonCentavos:5000000n,reserva4x1000Centavos:10000n});
});
test("GMF no se presupone en un retiro exento ni admite floats o negativos",()=>{
 const {reservarGmfCentavos,disponibleHoyConGmf}=
  require("../../modules/finanzas-personales/services/dineroExactoV81.service");
 assert.deepEqual(disponibleHoyConGmf({
  saldoCentavos:50000000n,porVencer7dCentavos:8000000n
 }),{disponibleCentavos:37000000n,colchonCentavos:5000000n,reserva4x1000Centavos:0n});
 for(const bad of [-1n,0.1,"1000",null])assert.throws(()=>reservarGmfCentavos(bad),TypeError);
});
