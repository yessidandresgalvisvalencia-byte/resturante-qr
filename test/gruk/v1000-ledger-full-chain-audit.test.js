"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {hashAsiento,verificarCadena}=require("../../core/finance/v1000/auditarLedger");
const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
function construir(){
 const uno={empresaId,sedeId,id:"01ARZ3NDEKTSV4RRFFQ69G5FAX",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FBB",tipo:"CREDITO",montoCentavos:5200000,antesCentavos:0,despuesCentavos:5200000,secuencia:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:"2026-10-14T00:00:00.000Z",hashAnterior:"0".repeat(64),deletedAt:null};
 uno.hash=hashAsiento(uno);
 const dos={...uno,id:"01ARZ3NDEKTSV4RRFFQ69G5FAZ",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FBC",tipo:"DEBITO",montoCentavos:1,antesCentavos:5200000,despuesCentavos:5199999,secuencia:2,hashAnterior:uno.hash,timestamp:"2026-10-14T00:01:00.000Z"};
 dos.hash=hashAsiento(dos);
 return {asientos:[uno,dos],cabecera:{secuencia:2,saldoCentavos:5199999,hashUltimo:dos.hash}};
}
test("V1000 cadena de 2 asientos conserva exactitud de un centavo",()=>{
 const data=construir();
 assert.equal(verificarCadena({empresaId,sedeId,...data}).saldoCentavos,5199999);
 assert.equal(hashAsiento({...data.asientos[0],timestamp:new Date(data.asientos[0].timestamp)}),data.asientos[0].hash);
});
test("V1000 detecta alteración del primer asiento aunque cabecera coincida",()=>{
 const data=construir();data.asientos[0].montoCentavos=5200001;
 assert.throws(()=>verificarCadena({empresaId,sedeId,...data}),/LEDGER_AUDITORIA_INCONSISTENTE/);
});
test("V1000 rechaza eliminación de asiento intermedio y cabecera adulterada",()=>{
 const data=construir();
 assert.throws(()=>verificarCadena({empresaId,sedeId,asientos:[data.asientos[1]],cabecera:data.cabecera}),/LEDGER_AUDITORIA_INCONSISTENTE/);
 assert.throws(()=>verificarCadena({empresaId,sedeId,asientos:data.asientos,cabecera:{...data.cabecera,saldoCentavos:5200000}}),/LEDGER_AUDITORIA_CABECERA_DIVERGENTE/);
});
