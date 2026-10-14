"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const {hashAsiento,verificarCadena}=require("../../core/finance/v1000/auditarLedger");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
test("V1000: medir auditoría determinística de 10 000 asientos y verificar integridad",t=>{
 const rows=[];
 let previous="0".repeat(64);
 for(let i=1;i<=10000;i++){
  const n=i.toString(32).toUpperCase().padStart(16,"0").replace(/I/g,"J").replace(/L/g,"M").replace(/O/g,"P").replace(/U/g,"V");
  const id="01ARZ3NDEK"+n;
  const m={id,operacionId:id,empresaId,sedeId,tipo:"CREDITO",montoCentavos:1,antesCentavos:i-1,despuesCentavos:i,secuencia:i,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",ip:"127.0.0.1",timestamp:"2026-10-14T00:00:00.000Z",hashAnterior:previous,deletedAt:null};
  m.hash=hashAsiento(m);previous=m.hash;rows.push(m);
 }
 const head={secuencia:10000,saldoCentavos:10000,hashUltimo:previous};
 const start=performance.now();
 const result=verificarCadena({empresaId,sedeId,asientos:rows,cabecera:head});
 const elapsed=performance.now()-start;
 assert.equal(result.ok,true);
 assert.equal(result.saldoCentavos,10000);
 t.diagnostic("auditoria_10000_asientos_ms="+elapsed.toFixed(2));
 // Diagnostic only: CI runners vary in speed. No arbitrary latency SLA.
});
