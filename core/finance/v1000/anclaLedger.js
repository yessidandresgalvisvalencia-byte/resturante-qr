"use strict";
const crypto=require("node:crypto");
const {tenant}=require("./validation");
const HASH=/^[0-9a-f]{64}$/;
const CAMPOS_DATOS=["empresaId","sedeId","secuencia","saldoCentavos","hashUltimo","emitidoEn"];
const CAMPOS_ANCLA=[...CAMPOS_DATOS,"algoritmo","version","firma"];
function camposExactos(obj,permitidos){
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||
    Object.keys(obj).length!==permitidos.length||
    Object.keys(obj).some(k=>!permitidos.includes(k)))
  throw Error("LEDGER_ANCLA_CAMPOS_NO_FIRMADOS");
}
function payload({empresaId,sedeId,secuencia,saldoCentavos,hashUltimo,emitidoEn}){
 tenant.parse({empresaId,sedeId});
 if(!Number.isSafeInteger(secuencia)||secuencia<0||
    !Number.isSafeInteger(saldoCentavos)||saldoCentavos<0||
    typeof hashUltimo!=="string"||!HASH.test(hashUltimo)||
    typeof emitidoEn!=="string"||!Number.isFinite(Date.parse(emitidoEn))||
    new Date(emitidoEn).toISOString()!==emitidoEn)
  throw Error("LEDGER_ANCLA_INVALIDA");
 if((secuencia===0&&(saldoCentavos!==0||hashUltimo!=="0".repeat(64)))||
    (secuencia>0&&hashUltimo==="0".repeat(64)))
  throw Error("LEDGER_ANCLA_GENESIS_INCONSISTENTE");
 return JSON.stringify(["GRUK_LEDGER_V1000_ANCHOR_V1",empresaId,sedeId,secuencia,saldoCentavos,hashUltimo,emitidoEn]);
}
function firmarAncla(datos,llavePrivadaPem){
 if(typeof llavePrivadaPem!=="string"||!llavePrivadaPem.trim())throw Error("LEDGER_ANCLA_LLAVE_AUSENTE");
 camposExactos(datos,CAMPOS_DATOS);
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
 camposExactos(ancla,CAMPOS_ANCLA);
 const key=crypto.createPublicKey(llavePublicaPem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("LEDGER_ANCLA_ALGORITMO_INVALIDO");
 const firma=Buffer.from(ancla.firma,"base64");
 if(firma.length!==64||!crypto.verify(null,Buffer.from(payload(ancla)),key,firma))
  throw Error("LEDGER_ANCLA_FIRMA_INVALIDA");
 return {ok:true,secuencia:ancla.secuencia,saldoCentavos:ancla.saldoCentavos,hashUltimo:ancla.hashUltimo};
}
function verificarAnclaContraCabecera({ancla,llavePublicaPem,empresaId,sedeId,cabecera}){
 const prueba=verificarAncla(ancla,llavePublicaPem);
 tenant.parse({empresaId,sedeId});
 if(ancla.empresaId!==empresaId||ancla.sedeId!==sedeId)
  throw Error("LEDGER_ANCLA_TENANT_INCONSISTENTE");
 if(!cabecera||!Number.isSafeInteger(cabecera.secuencia)||cabecera.secuencia<0||
    !Number.isSafeInteger(cabecera.saldoCentavos)||cabecera.saldoCentavos<0||
    typeof cabecera.hashUltimo!=="string"||!HASH.test(cabecera.hashUltimo))
  throw Error("LEDGER_ANCLA_CABECERA_INVALIDA");
 if(cabecera.secuencia<prueba.secuencia)
  throw Error("LEDGER_ANCLA_CABECERA_RETROCEDIDA");
 // A later head requires independent verification of every intermediate link.
 // Never treat an old signature as a proof of an unverified newer balance.
 if(cabecera.secuencia>prueba.secuencia)
  throw Error("LEDGER_ANCLA_REQUIERE_VERIFICAR_CONTINUIDAD");
 if(cabecera.saldoCentavos!==prueba.saldoCentavos||
    cabecera.hashUltimo!==prueba.hashUltimo)
  throw Error("LEDGER_ANCLA_CABECERA_DIVERGENTE");
 return {ok:true,secuencia:prueba.secuencia,saldoCentavos:prueba.saldoCentavos,hashUltimo:prueba.hashUltimo};
}
function verificarContinuidadDesdeAncla({ancla,llavePublicaPem,empresaId,sedeId,asientos,cabecera}){
 const base=verificarAncla(ancla,llavePublicaPem);
 tenant.parse({empresaId,sedeId});
 if(ancla.empresaId!==empresaId||ancla.sedeId!==sedeId)
  throw Error("LEDGER_ANCLA_TENANT_INCONSISTENTE");
 if(!Array.isArray(asientos)||!cabecera||!Number.isSafeInteger(cabecera.secuencia)||
    !Number.isSafeInteger(cabecera.saldoCentavos)||
    cabecera.saldoCentavos<0||typeof cabecera.hashUltimo!=="string"||
    !HASH.test(cabecera.hashUltimo))
  throw Error("LEDGER_ANCLA_CABECERA_INVALIDA");
 if(cabecera.secuencia<base.secuencia)throw Error("LEDGER_ANCLA_CABECERA_RETROCEDIDA");
 let secuencia=base.secuencia,saldo=base.saldoCentavos,hash=base.hashUltimo;
 const operaciones=new Set();
 const {hashAsiento}=require("./auditarLedger");
 for(const m of asientos){
  if(!m||m.empresaId!==empresaId||m.sedeId!==sedeId||
     m.secuencia!==secuencia+1||m.hashAnterior!==hash||
     m.antesCentavos!==saldo||m.deletedAt!==null||
     !Number.isSafeInteger(m.montoCentavos)||m.montoCentavos<=0||
     !["CREDITO","DEBITO"].includes(m.tipo)||
     typeof m.operacionId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(m.operacionId)||
     operaciones.has(m.operacionId)||hashAsiento(m)!==m.hash)
   throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
  const next=BigInt(saldo)+(m.tipo==="CREDITO"?1n:-1n)*BigInt(m.montoCentavos);
  if(next<0n||next>BigInt(Number.MAX_SAFE_INTEGER)||
     m.despuesCentavos!==Number(next))
   throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
  operaciones.add(m.operacionId);
  secuencia=m.secuencia;saldo=m.despuesCentavos;hash=m.hash;
 }
 if(cabecera.secuencia!==secuencia||cabecera.saldoCentavos!==saldo||
    cabecera.hashUltimo!==hash)
  throw Error("LEDGER_ANCLA_CABECERA_DIVERGENTE");
 return {ok:true,secuencia,saldoCentavos:saldo,hashUltimo:hash};
}
function verificarAnclaConClaveConfiable({ancla,clavesConfiables,empresaId,sedeId}){
 tenant.parse({empresaId,sedeId});
 if(!Array.isArray(clavesConfiables)||clavesConfiables.length!==1||
    typeof clavesConfiables[0]!=="string"||!clavesConfiables[0].trim())
  throw Error("LEDGER_ANCLA_CLAVE_CONFIABLE_REQUERIDA");
 // Trust keys must be provisioned independently of the untrusted anchor.
 const result=verificarAncla(ancla,clavesConfiables[0]);
 if(ancla.empresaId!==empresaId||ancla.sedeId!==sedeId)
  throw Error("LEDGER_ANCLA_TENANT_INCONSISTENTE");
 return result;
}
function huellaClaveEd25519(llavePublicaPem){
 if(typeof llavePublicaPem!=="string"||!llavePublicaPem.trim())
  throw Error("LEDGER_ANCLA_LLAVE_AUSENTE");
 const key=crypto.createPublicKey(llavePublicaPem);
 if(key.asymmetricKeyType!=="ed25519")
  throw Error("LEDGER_ANCLA_ALGORITMO_INVALIDO");
 return crypto.createHash("sha256").update(key.export({format:"der",type:"spki"})).digest("hex");
}
function verificarAnclaConClaveFijada({ancla,llavePublicaPem,huellaAutorizada,empresaId,sedeId}){
 if(typeof huellaAutorizada!=="string"||!HASH.test(huellaAutorizada))
  throw Error("LEDGER_ANCLA_HUELLA_NO_AUTORIZADA");
 const actual=huellaClaveEd25519(llavePublicaPem);
 if(!crypto.timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(huellaAutorizada,"hex")))
  throw Error("LEDGER_ANCLA_LLAVE_NO_AUTORIZADA");
 return verificarAnclaConClaveConfiable({ancla,clavesConfiables:[llavePublicaPem],empresaId,sedeId});
}
function verificarCabeceraConClaveFijada({ancla,llavePublicaPem,huellaAutorizada,empresaId,sedeId,cabecera}){
 verificarAnclaConClaveFijada({ancla,llavePublicaPem,huellaAutorizada,empresaId,sedeId});
 return verificarAnclaContraCabecera({ancla,llavePublicaPem,empresaId,sedeId,cabecera});
}
module.exports={firmarAncla,verificarAncla,verificarAnclaContraCabecera,verificarContinuidadDesdeAncla,verificarAnclaConClaveConfiable,huellaClaveEd25519,verificarAnclaConClaveFijada,verificarCabeceraConClaveFijada};
