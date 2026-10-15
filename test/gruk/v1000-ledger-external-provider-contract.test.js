"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {firmarAncla,huellaClaveEd25519}=require("../../core/finance/v1000/anclaLedger");
const {recuperarAnclaExternaConfiable}=require("../../core/finance/v1000/obtenerAnclaExterna");
test("V1000: falla cerrado si no hay custodia o ancla externa firmada",async()=>{
 const pair=crypto.generateKeyPairSync("ed25519");
 const priv=pair.privateKey.export({type:"pkcs8",format:"pem"});
 const pub=pair.publicKey.export({type:"spki",format:"pem"});
 const datos={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
 secuencia:0,saldoCentavos:0,hashUltimo:"0".repeat(64),emitidoEn:"2026-10-14T00:00:00.000Z"};
 const ancla=firmarAncla(datos,priv);
 const args={empresaId:datos.empresaId,sedeId:datos.sedeId,llavePublicaPem:pub,
 huellaAutorizada:huellaClaveEd25519(pub)};
 const provider={separacionDePrivilegiosVerificada:true,almacenamientoInmutableVerificado:true,
  obtenerUltimaAncla:async()=>ancla};
 assert.deepEqual(await recuperarAnclaExternaConfiable({...args,provider}),ancla);
 await assert.rejects(recuperarAnclaExternaConfiable(args),/LEDGER_ANCLA_PROVEEDOR_EXTERNO_REQUERIDO/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,separacionDePrivilegiosVerificada:false}}),/LEDGER_ANCLA_CUSTODIA_NO_CERTIFICADA/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,almacenamientoInmutableVerificado:false}}),/LEDGER_ANCLA_ALMACENAMIENTO_NO_CERTIFICADO/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,obtenerUltimaAncla:async()=>null}}),/LEDGER_ANCLA_EXTERNA_AUSENTE/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,obtenerUltimaAncla:async()=>({...ancla,saldoCentavos:1})}}),/LEDGER_ANCLA_GENESIS_INCONSISTENTE|LEDGER_ANCLA_FIRMA_INVALIDA/);
});
