"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {firmarAncla,huellaClaveEd25519,verificarCabeceraConClaveFijada}=require("../../core/finance/v1000/anclaLedger");
test("V1000: ancla no puede tomarse de una clave publicada junto a evidencia no confiable",()=>{
 const trusted=crypto.generateKeyPairSync("ed25519");
 const untrusted=crypto.generateKeyPairSync("ed25519");
 const publicTrusted=trusted.publicKey.export({format:"pem",type:"spki"});
 const publicUntrusted=untrusted.publicKey.export({format:"pem",type:"spki"});
 const privateUntrusted=untrusted.privateKey.export({format:"pem",type:"pkcs8"});
 const ancla=firmarAncla({empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",
   sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",secuencia:0,saldoCentavos:0,
   hashUltimo:"0".repeat(64),emitidoEn:"2026-10-14T00:00:00.000Z"},privateUntrusted);
 const args={ancla,llavePublicaPem:publicUntrusted,huellaAutorizada:huellaClaveEd25519(publicTrusted),
  empresaId:ancla.empresaId,sedeId:ancla.sedeId,
  cabecera:{secuencia:0,saldoCentavos:0,hashUltimo:"0".repeat(64)}};
 assert.throws(()=>verificarCabeceraConClaveFijada(args),/LEDGER_ANCLA_LLAVE_NO_AUTORIZADA/);
 // Deliberately show that authorization cannot come from the untrusted signer.
 assert.equal(verificarCabeceraConClaveFijada({...args,huellaAutorizada:huellaClaveEd25519(publicUntrusted)}).ok,true);
});
