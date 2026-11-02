"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {eventoCompensatorio,verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {vigente}=require("../../modules/finanzas-personales/services/estadoCompensadoPersonal.service");
const {proyectar,proyectarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const original={usuarioId:"507f1f77bcf86cd799439011",movimientoId:"507f1f77bcf86cd799439012",tipo:"GASTO",montoMinor:3000,concepto:"Ensayo",categoria:"OTROS"};
const genesis="0".repeat(64),fechaISO="2026-11-02T06:00:00.000Z";
const evento=(o,tipo,previo,key,cambios={})=>eventoCompensatorio({original:o,tipo,prevHash:previo?.hashActual||genesis,secuencia:(previo?.secuencia||0)+1,idempotencyKey:key,fechaISO,cambios,...(tipo==="RESTAURACION"?{anulacionHash:previo.hashActual}:{})});
test("restauración V5 enlaza anulación exacta y conserva el importe corregido",()=>{
 const c=evento(original,"CORRECCION",null,"corregir",{montoMinor:2500}),o={...original,montoMinor:2500};
 const a=evento(o,"ANULACION",c,"anular"),r=evento(o,"RESTAURACION",a,"restaurar");
 assert.equal(r.version,5);assert.equal(r.anulacionHash,a.hashActual);assert.equal(r.deltaCajaMinor,"-2500");
 assert.equal(vigente(original,[c,a,r]).anulado,false);assert.equal(vigente(original,[c,a,r]).actual.montoMinor,2500);
 assert.equal(verificarCadena([c,a,r],{prevHash:genesis}),true);
 const otra=evento(o,"ANULACION",r,"anular2"),restaurar2=evento(o,"RESTAURACION",otra,"restaurar2");
 assert.equal(vigente(original,[c,a,r,otra,restaurar2]).anulado,false);
 const corregir=evento(o,"CORRECCION",r,"corregir2",{montoMinor:2400});
 assert.equal(vigente(original,[c,a,r,corregir]).actual.montoMinor,2400);
});
test("proyecciones vigentes y de caja restauran una sola vez y preservan las fuentes",()=>{
 for(const tipo of ["INGRESO","GASTO"]){
  const o={...original,tipo},a=evento(o,"ANULACION",null,"anular"),r=evento(o,"RESTAURACION",a,"restaurar");
  const fuente={...o,_id:o.movimientoId,estado:"ACTIVA",moneda:"COP",impactoCaja:true,medioPago:"EFECTIVO",cuentaId:"507f1f77bcf86cd799439013",fecha:new Date(fechaISO)};
  const antes=JSON.stringify(fuente),datos={usuarioId:o.usuarioId,fuentes:[fuente],eventos:[a,r],cursor:{_id:o.usuarioId,secuencia:2,hashActual:r.hashActual}};
  assert.equal(proyectar(datos)[0].estado,"ACTIVA");
  assert.equal(proyectarCaja(datos).reduce((n,f)=>n+(f.tipo==="INGRESO"?BigInt(f.montoMinor):-BigInt(f.montoMinor)),0n),tipo==="INGRESO"?3000n:-3000n);
  assert.equal(JSON.stringify(fuente),antes);
 }
});
test("rechaza restauración sin anulación, referencia ajena, doble restauración o importe alterado",()=>{
 const a=evento(original,"ANULACION",null,"anular"),r=evento(original,"RESTAURACION",a,"restaurar");
 assert.throws(()=>vigente(original,[r]),/INTEGRIDAD_LEDGER/);
 const falso=eventoCompensatorio({...r,prevHash:a.hashActual,anulacionHash:"f".repeat(64)});
 assert.throws(()=>vigente(original,[a,falso]),/INTEGRIDAD_LEDGER/);
 const doble=eventoCompensatorio({...r,idempotencyKey:"otra",secuencia:3,prevHash:r.hashActual});
 assert.throws(()=>vigente(original,[a,r,doble]),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>eventoCompensatorio({...r,cambios:{montoMinor:1}}),/inválido/);
 assert.throws(()=>eventoCompensatorio({...r,anulacionHash:undefined}),/inválida/);
 assert.throws(()=>eventoCompensatorio({...r,original:{...original,tipo:"PAGO_DEUDA",impactoCaja:true}}));
});
