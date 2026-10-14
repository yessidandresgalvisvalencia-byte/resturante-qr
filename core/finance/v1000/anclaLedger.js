"use strict";
const crypto=require("node:crypto");
const {tenant}=require("./validation");
const HASH=/^[0-9a-f]{64}$/;
function payload({empresaId,sedeId,secuencia,saldoCentavos,hashUltimo,emitidoEn}){
 tenant.parse({empresaId,sedeId});
 if(!Number.isSafeInteger(secuencia)||secuencia<0||
    !Number.isSafeInteger(saldoCentavos)||saldoCentavos<0||
    typeof hashUltimo!=="string"||!HASH.test(hashUltimo)||
    typeof emitidoEn!=="string"||!Number.isFinite(Date.parse(emitidoEn))||
    new Date(emitidoEn).toISOString()!==emitidoEn)
  throw Error("LEDGER_ANCLA_INVALIDA");
 return JSON.stringify(["GRUK_LEDGER_V1000_ANCHOR_V1",empresaId,sedeId,secuencia,saldoCentavos,hashUltimo,emitidoEn]);
}
function firmarAncla(datos,llavePrivadaPem){
 if(typeof llavePrivadaPem!=="string"||!llavePrivadaPem.trim())throw Error("LEDGER_ANCLA_LLAVE_AUSENTE");
 const message=payload(datos);
 const key=crypto.createPrivateKey(llavePrivadaPem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("LEDGER_ANCLA_ALGORITMO_INVALIDO");
 return {...datos,algoritmo:"Ed25519",version:1,
  firma:crypto.sign(null,Buffer.from(message),key).toString("base64")};
}
function verificarAncla(ancla,llavePublicaPem){
 if(!ancla||ancla.version!==1||ancla.algoritmo!=="Ed25519"||
    typeof ancla.firma!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(ancla.firma)||
    typeof llavePublicaPem!=="string"||!llavePublicaPem.trim())
   throw Error("LEDGER_ANCLA_FORMATO_INVALIDO");
 const key=crypto.createPublicKey(llavePublicaPem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("LEDGER_ANCLA_ALGORITMO_INVALIDO");
 const firma=Buffer.from(ancla.firma,"base64");
 if(firma.length!==64||!crypto.verify(null,Buffer.from(payload(ancla)),key,firma))
  throw Error("LEDGER_ANCLA_FIRMA_INVALIDA");
 return {ok:true,secuencia:ancla.secuencia,saldoCentavos:ancla.saldoCentavos,hashUltimo:ancla.hashUltimo};
}
module.exports={firmarAncla,verificarAncla};
