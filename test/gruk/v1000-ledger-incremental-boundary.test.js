"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearVerificadorCadena,hashAsiento,verificarCadena}=require("../../core/finance/v1000/auditarLedger");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const alphabet="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function opId(value){let n=value,s="";for(let i=0;i<16;i++){s=alphabet[n%32]+s;n=Math.floor(n/32);}return "01ARZ3NDEK"+s;}
function generar(cantidad){
 const asientos=[];let anterior="0".repeat(64);
 for(let i=1;i<=cantidad;i++){
  const m={id:opId(i),operacionId:opId(i),empresaId,sedeId,tipo:"CREDITO",
   montoCentavos:1,antesCentavos:i-1,despuesCentavos:i,secuencia:i,
   actorId:opId(40000),ip:"127.0.0.1",timestamp:"2026-10-14T00:00:00.000Z",
   hashAnterior:anterior,deletedAt:null};
  m.hash=hashAsiento(m);anterior=m.hash;asientos.push(m);
 }
 return {asientos,cabecera:{secuencia:cantidad,saldoCentavos:cantidad,hashUltimo:anterior}};
}
test("V1000: verificación incremental conserva resultado idéntico con lotes de distinto tamaño",()=>{
 const {asientos,cabecera}=generar(1001);
 const completo=verificarCadena({empresaId,sedeId,asientos,cabecera});
 for(const tamano of [1,7,500,1001]){
  const incremental=crearVerificadorCadena({empresaId,sedeId});
  for(let i=0;i<asientos.length;i+=tamano)
   for(const asiento of asientos.slice(i,i+tamano))incremental.agregar(asiento);
  assert.deepEqual(incremental.finalizar(cabecera),completo);
 }
});
test("V1000: falla cerrado ante hueco de secuencia cruzando límite de lote",()=>{
 const {asientos}=generar(501);
 const incremental=crearVerificadorCadena({empresaId,sedeId});
 for(const asiento of asientos.slice(0,500))incremental.agregar(asiento);
 assert.throws(()=>incremental.agregar(asientos[500]&&{...asientos[500],secuencia:502}),/LEDGER_AUDITORIA_INCONSISTENTE/);
});
test("V1000: falla cerrado ante hash alterado en el segundo lote",()=>{
 const {asientos}=generar(501);
 const incremental=crearVerificadorCadena({empresaId,sedeId});
 for(const asiento of asientos.slice(0,500))incremental.agregar(asiento);
 assert.throws(()=>incremental.agregar({...asientos[500],hashAnterior:"f".repeat(64)}),/LEDGER_AUDITORIA_INCONSISTENTE/);
});
test("V1000: operación duplicada en lotes separados es rechazada",()=>{
 const {asientos}=generar(501);
 const incremental=crearVerificadorCadena({empresaId,sedeId});
 for(const asiento of asientos.slice(0,500))incremental.agregar(asiento);
 assert.throws(()=>incremental.agregar({...asientos[500],operacionId:asientos[0].operacionId}),/LEDGER_AUDITORIA_OPERACION_DUPLICADA/);
});
test("V1000: rechaza cabecera adelantada tras consumir menos movimientos",()=>{
 const {asientos,cabecera}=generar(501);
 const incremental=crearVerificadorCadena({empresaId,sedeId});
 for(const asiento of asientos.slice(0,500))incremental.agregar(asiento);
 assert.throws(()=>incremental.finalizar(cabecera),/LEDGER_AUDITORIA_CABECERA_DIVERGENTE/);
});
