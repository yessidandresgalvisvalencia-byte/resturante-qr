"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const {firmarAncla,huellaClaveEd25519}=require("../../core/finance/v1000/anclaLedger");
const {auditarContinuidadConAnclaExterna}=require("../../core/finance/v1000/obtenerAnclaExterna");
test("V1000: auditoría verifica ambos tramos checkpoint-ancla-cabecera y rechaza ausencia de tramo",async()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 const priv=privateKey.export({format:"pem",type:"pkcs8"});
 const pub=publicKey.export({format:"pem",type:"spki"});
 const empresaId="01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId="01ARZ3NDEKTSV4RRFFQ69G5FAW";
 const checkpointConfiable={empresaId,sedeId,secuencia:0,saldoCentavos:0,hashUltimo:"0".repeat(64)};
 const make=(secuencia,antes,monto,hashAnterior,operacionId)=> {
  const m={id:"01ARZ3NDEKTSV4RRFFQ69G5FB5",operacionId,empresaId,sedeId,
   actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",tipo:"CREDITO",montoCentavos:monto,
   antesCentavos:antes,despuesCentavos:antes+monto,secuencia,ip:"127.0.0.1",
   timestamp:"2026-10-14T00:00:00.000Z",hashAnterior,deletedAt:null};
  m.hash=hashAsiento(m);return m;
 };
 const m1=make(1,0,100,"0".repeat(64),"01ARZ3NDEKTSV4RRFFQ69G5FB6");
 const m2=make(2,100,20,m1.hash,"01ARZ3NDEKTSV4RRFFQ69G5FB7");
 const ancla=firmarAncla({empresaId,sedeId,secuencia:1,saldoCentavos:100,hashUltimo:m1.hash,
  emitidoEn:"2026-10-14T00:01:00.000Z"},priv);
 const args={empresaId,sedeId,checkpointConfiable,asientosDesdeCheckpoint:[m1],
  asientosDesdeAncla:[m2],cabecera:{secuencia:2,saldoCentavos:120,hashUltimo:m2.hash},
  llavePublicaPem:pub,huellaAutorizada:huellaClaveEd25519(pub),
  provider:{separacionDePrivilegiosVerificada:true,almacenamientoInmutableVerificado:true,
   obtenerUltimaAncla:async()=>ancla}};
 const audit=await auditarContinuidadConAnclaExterna(args);
 assert.equal(audit.saldoCentavos,120);
 assert.equal(audit.anclaSecuencia,1);
 assert.equal(audit.checkpointSecuencia,0);
 await assert.rejects(auditarContinuidadConAnclaExterna({...args,asientosDesdeAncla:[]}),/LEDGER_ANCLA_CONTINUIDAD_INVALIDA/);
 await assert.rejects(auditarContinuidadConAnclaExterna({...args,asientosDesdeCheckpoint:[]}),/LEDGER_ANCLA_CONTINUIDAD_INVALIDA/);
 await assert.rejects(auditarContinuidadConAnclaExterna({...args,asientosDesdeAncla:[{...m2,montoCentavos:21}]}),/LEDGER_ANCLA_CONTINUIDAD_INVALIDA/);
 await assert.rejects(auditarContinuidadConAnclaExterna({...args,asientosDesdeAncla:[m2],cabecera:{...args.cabecera,saldoCentavos:121}}),/LEDGER_ANCLA_CABECERA_DIVERGENTE/);
});
