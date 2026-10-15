"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {hashAsiento,verificarCadena}=require("../../core/finance/v1000/auditarLedger");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
function asientos(){
 const a={empresaId,sedeId,id:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FB0",tipo:"CREDITO",montoCentavos:100,antesCentavos:0,despuesCentavos:100,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:"2026-10-14T00:00:00.000Z",hashAnterior:"0".repeat(64),deletedAt:null};
 a.hash=hashAsiento(a);
 const b={...a,id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",secuencia:2,montoCentavos:1,antesCentavos:100,despuesCentavos:101,hashAnterior:a.hash};
 b.hash=hashAsiento(b);
 return [a,b];
}
test("Auditoría rechaza operación repetida incluso si se recalculan todos los hashes",()=>{
 const rows=asientos();
 assert.throws(()=>verificarCadena({empresaId,sedeId,asientos:rows,cabecera:{secuencia:2,saldoCentavos:101,hashUltimo:rows[1].hash}}),/LEDGER_AUDITORIA_OPERACION_DUPLICADA/);
 rows[1].operacionId="01ARZ3NDEKTSV4RRFFQ69G5FB1";rows[1].hash=hashAsiento(rows[1]);
 assert.equal(verificarCadena({empresaId,sedeId,asientos:rows,cabecera:{secuencia:2,saldoCentavos:101,hashUltimo:rows[1].hash}}).ok,true);
});
