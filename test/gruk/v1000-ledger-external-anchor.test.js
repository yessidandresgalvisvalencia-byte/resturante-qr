"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {firmarAncla,verificarAncla,verificarAnclaContraCabecera}=require("../../core/finance/v1000/anclaLedger");
const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
const priv=privateKey.export({type:"pkcs8",format:"pem"});
const pub=publicKey.export({type:"spki",format:"pem"});
const sample={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
 secuencia:1000,saldoCentavos:24500,hashUltimo:"a".repeat(64),emitidoEn:"2026-10-14T00:00:00.000Z"};
test("V1000: ancla Ed25519 auténtica verifica identidad, saldo, secuencia y hash",()=>{
 const ancla=firmarAncla(sample,priv);
 assert.equal(verificarAncla(ancla,pub).ok,true);
 for(const change of [
  {saldoCentavos:24501},{secuencia:999},{hashUltimo:"b".repeat(64)},
  {empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAX"},{sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAY"},
  {emitidoEn:"2026-10-15T00:00:00.000Z"}
 ])assert.throws(()=>verificarAncla({...ancla,...change},pub),/LEDGER_ANCLA_FIRMA_INVALIDA/);
});
test("V1000: otra llave pública no puede verificar el ancla",()=>{
 const ancla=firmarAncla(sample,priv);
 const other=crypto.generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"});
 assert.throws(()=>verificarAncla(ancla,other),/LEDGER_ANCLA_FIRMA_INVALIDA/);
});
test("V1000: algoritmos y formatos inválidos son rechazados",()=>{
 assert.throws(()=>firmarAncla(sample,""),/LEDGER_ANCLA_LLAVE_AUSENTE/);
 assert.throws(()=>firmarAncla({...sample,saldoCentavos:1.5},priv),/LEDGER_ANCLA_INVALIDA/);
 const ancla=firmarAncla(sample,priv);
 assert.throws(()=>verificarAncla({...ancla,algoritmo:"none"},pub),/LEDGER_ANCLA_FORMATO_INVALIDO/);
});

test("V1000: firma auténtica solo avala cabecera del mismo tenant y secuencia exacta",()=>{
 const ancla=firmarAncla(sample,priv);
 const cabecera={secuencia:sample.secuencia,saldoCentavos:sample.saldoCentavos,hashUltimo:sample.hashUltimo};
 const args={ancla,llavePublicaPem:pub,empresaId:sample.empresaId,sedeId:sample.sedeId,cabecera};
 assert.equal(verificarAnclaContraCabecera(args).ok,true);
 assert.throws(()=>verificarAnclaContraCabecera({...args,empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAX"}),/LEDGER_ANCLA_TENANT_INCONSISTENTE/);
 assert.throws(()=>verificarAnclaContraCabecera({...args,cabecera:{...cabecera,secuencia:999}}),/LEDGER_ANCLA_CABECERA_RETROCEDIDA/);
 assert.throws(()=>verificarAnclaContraCabecera({...args,cabecera:{...cabecera,secuencia:1001}}),/LEDGER_ANCLA_REQUIERE_VERIFICAR_CONTINUIDAD/);
 assert.throws(()=>verificarAnclaContraCabecera({...args,cabecera:{...cabecera,hashUltimo:"b".repeat(64)}}),/LEDGER_ANCLA_CABECERA_DIVERGENTE/);
 assert.throws(()=>verificarAnclaContraCabecera({...args,cabecera:{...cabecera,saldoCentavos:24501}}),/LEDGER_ANCLA_CABECERA_DIVERGENTE/);
});
