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
 const red=new Error("socket reset");
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,obtenerUltimaAncla:async()=>{throw red;}}}),err=>err.message==="LEDGER_ANCLA_EXTERNA_NO_DISPONIBLE"&&err.cause===red);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,obtenerUltimaAncla:async()=>firmarAncla({...datos,empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAX"},priv)}}),/LEDGER_ANCLA_TENANT_INCONSISTENTE/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,provider:{...provider,obtenerUltimaAncla:async()=>({...ancla,saldoCentavos:1})}}),/LEDGER_ANCLA_GENESIS_INCONSISTENTE|LEDGER_ANCLA_FIRMA_INVALIDA/);
});

test("V1000: piso confiable impide rollback de evidencia externa firmada",async()=>{
 const crypto=require("node:crypto");
 const {firmarAncla,huellaClaveEd25519}=require("../../core/finance/v1000/anclaLedger");
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 const priv=privateKey.export({type:"pkcs8",format:"pem"});
 const pub=publicKey.export({type:"spki",format:"pem"});
 const old=firmarAncla({empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",
  sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",secuencia:1,saldoCentavos:10,
  hashUltimo:"a".repeat(64),emitidoEn:"2026-10-14T00:00:00.000Z"},priv);
 const args={empresaId:old.empresaId,sedeId:old.sedeId,llavePublicaPem:pub,
  huellaAutorizada:huellaClaveEd25519(pub),
  provider:{separacionDePrivilegiosVerificada:true,almacenamientoInmutableVerificado:true,
   obtenerUltimaAncla:async()=>old}};
 assert.equal((await recuperarAnclaExternaConfiable({...args,secuenciaMinimaConfiable:1})).secuencia,1);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,secuenciaMinimaConfiable:2}),/LEDGER_ANCLA_RETROCESO_DETECTADO/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,secuenciaMinimaConfiable:-1}),/LEDGER_ANCLA_PISO_INVALIDO/);
});

test("V1000: checkpoint independiente detecta dos anclas válidas pero contradictorias",async()=>{
 const crypto=require("node:crypto");
 const {firmarAncla,huellaClaveEd25519}=require("../../core/finance/v1000/anclaLedger");
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 const priv=privateKey.export({type:"pkcs8",format:"pem"});
 const pub=publicKey.export({type:"spki",format:"pem"});
 const state={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",
  sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",secuencia:3,
  saldoCentavos:120,hashUltimo:"a".repeat(64),emitidoEn:"2026-10-14T00:00:00.000Z"};
 const forged=firmarAncla({...state,saldoCentavos:121,hashUltimo:"b".repeat(64)},priv);
 const trusted={secuencia:3,saldoCentavos:120,hashUltimo:"a".repeat(64)};
 const args={empresaId:state.empresaId,sedeId:state.sedeId,llavePublicaPem:pub,
  huellaAutorizada:huellaClaveEd25519(pub),checkpointConfiable:trusted,
  provider:{separacionDePrivilegiosVerificada:true,almacenamientoInmutableVerificado:true,
   obtenerUltimaAncla:async()=>forged}};
 await assert.rejects(recuperarAnclaExternaConfiable(args),/LEDGER_ANCLA_EQUIVOCACION_DETECTADA/);
 await assert.rejects(recuperarAnclaExternaConfiable({...args,checkpointConfiable:{...trusted,secuencia:4}}),/LEDGER_ANCLA_RETROCESO_DETECTADO/);
 assert.equal((await recuperarAnclaExternaConfiable({...args,checkpointConfiable:
  {secuencia:3,saldoCentavos:121,hashUltimo:"b".repeat(64)}})).hashUltimo,"b".repeat(64));
});
