"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
const unknown=()=>{const e=new Error("network timeout at commit");e.hasErrorLabel=x=>x==="UnknownTransactionCommitResult";return e;};
function harness({existing}){
 let writeAttempts=0,reads=0,ended=0;
 const fakeSession=()=>({withTransaction:async fn=>{if(fn.toString().includes("const duplicado=await Movimiento.findOne")){writeAttempts++;throw unknown();}return fn();},endSession:async()=>{ended++;}});
 const query=value=>({session:()=>({lean:async()=>value})});
 const op={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",tipo:"CREDITO",montoCentavos:100,ip:"127.0.0.1"};
 const movimiento={...op,id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",secuencia:1,antesCentavos:0,despuesCentavos:100,timestamp:"2026-10-14T00:00:00.000Z",hashAnterior:"0".repeat(64),deletedAt:null};
 const {hashAsiento,crearVerificadorCadena}=require("../../core/finance/v1000/auditarLedger");
 movimiento.hash=hashAsiento(movimiento);
 const cursor={async *[Symbol.asyncIterator](){yield movimiento;},close:async()=>{}};
 const fakeMovimiento={
  findOne:()=>{reads++;return query(existing?movimiento:null);},
  find:()=>({sort:()=>({limit:()=>({session:()=>({lean:()=>({
   cursor:()=>cursor
  })})})})})
 };
 const fakeSaldo={findOne:()=>query({secuencia:1,saldoCentavos:100,hashUltimo:movimiento.hash})};
 const mocks={
  "node:crypto":require("node:crypto"),
  "../core/finance/v1000/auditarLedger":{hashAsiento,crearVerificadorCadena},
  mongoose:{startSession:async()=>fakeSession()},
  "../models/SaldoLedgerV1000":fakeSaldo,
  "../models/MovimientoLedgerV1000":fakeMovimiento,
  "../core/finance/v1000/validation":{tenant:{parse:()=>{}},ulid:{parse:()=>{}},movimiento:{parse:()=>{}}},
  zod:require("zod")
 };
 const context={module:{exports:{}},exports:{},require:id=>{if(!(id in mocks))throw Error("Unexpected module "+id);return mocks[id];},Buffer,Date,BigInt,Error,Number,Set};
 vm.runInNewContext(source,context,{filename:"ledgerV1000.service.js"});
 return {run:()=>context.module.exports.registrarMovimiento(op),stats:()=>({writeAttempts,reads,ended})};
}
test("V1000: commit incierto ya persistido devuelve operación existente tras auditoría, sin repetir escritura",async()=>{
 const h=harness({existing:true});
 const result=await h.run();
 assert.equal(result.secuencia,1);
 assert.equal(result.montoCentavos,100);
 assert.equal(h.stats().writeAttempts,0);
});
test("V1000: commit incierto sin operación confirmada nunca declara éxito ni repite cobro",async()=>{
 const h=harness({existing:false});
 await assert.rejects(h.run(),/LEDGER_CONFIRMACION_INDETERMINADA/);
 assert.equal(h.stats().writeAttempts,1);
 assert.ok(h.stats().ended>=2);
});
