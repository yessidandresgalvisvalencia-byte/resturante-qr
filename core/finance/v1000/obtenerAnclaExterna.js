"use strict";
const {verificarAnclaConClaveFijada}=require("./anclaLedger");

/**
 * Contract for externally obtained, immutable evidence.
 * The provider is injected by the auditor, never created from ledger data.
 * No database persistence, network client or signing key is implied here.
 */
async function recuperarAnclaExternaConfiable({empresaId,sedeId,provider,llavePublicaPem,huellaAutorizada,secuenciaMinimaConfiable,checkpointConfiable,asientosDesdeCheckpoint}){
 if(secuenciaMinimaConfiable!==undefined&&
    (!Number.isSafeInteger(secuenciaMinimaConfiable)||secuenciaMinimaConfiable<0))
  throw Error("LEDGER_ANCLA_PISO_INVALIDO");
 if(!provider||typeof provider.obtenerUltimaAncla!=="function")
  throw Error("LEDGER_ANCLA_PROVEEDOR_EXTERNO_REQUERIDO");
 if(!provider.separacionDePrivilegiosVerificada||provider.separacionDePrivilegiosVerificada!==true)
  throw Error("LEDGER_ANCLA_CUSTODIA_NO_CERTIFICADA");
 if(typeof provider.almacenamientoInmutableVerificado!=="boolean"||!provider.almacenamientoInmutableVerificado)
  throw Error("LEDGER_ANCLA_ALMACENAMIENTO_NO_CERTIFICADO");
 let ancla;
 try{
  ancla=await provider.obtenerUltimaAncla({empresaId,sedeId});
 }catch(err){
  const fallo=new Error("LEDGER_ANCLA_EXTERNA_NO_DISPONIBLE",{cause:err});
  throw fallo;
 }
 if(!ancla)throw Error("LEDGER_ANCLA_EXTERNA_AUSENTE");
 // Never treat an externally fetched anchor as trusted before verifying key pinning.
 // The monotonic floor is caller supplied and must originate from a separate trust domain.
 verificarAnclaConClaveFijada({ancla,llavePublicaPem,huellaAutorizada,empresaId,sedeId});
 if(checkpointConfiable!==undefined){
  const c=checkpointConfiable;
  if(!c||!Number.isSafeInteger(c.secuencia)||c.secuencia<0||
     !Number.isSafeInteger(c.saldoCentavos)||c.saldoCentavos<0||
     typeof c.hashUltimo!=="string"||!/^[0-9a-f]{64}$/.test(c.hashUltimo))
   throw Error("LEDGER_ANCLA_CHECKPOINT_INVALIDO");
  if(ancla.secuencia<c.secuencia)throw Error("LEDGER_ANCLA_RETROCESO_DETECTADO");
  if(ancla.secuencia===c.secuencia&&
     (ancla.hashUltimo!==c.hashUltimo||ancla.saldoCentavos!==c.saldoCentavos))
   throw Error("LEDGER_ANCLA_EQUIVOCACION_DETECTADA");
  if(ancla.secuencia>c.secuencia){
   if(!Array.isArray(asientosDesdeCheckpoint))
    throw Error("LEDGER_ANCLA_CONTINUIDAD_REQUERIDA");
   const tramo=ancla.secuencia-c.secuencia;
   if(tramo>100000)throw Error("LEDGER_ANCLA_CONTINUIDAD_EXCEDE_LIMITE");
   if(asientosDesdeCheckpoint.length!==tramo)
    throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
   // The independently trusted checkpoint is the start state. Never infer it
   // from the newer anchor or the compromised operational ledger.
   const {hashAsiento}=require("./auditarLedger");
   let sec=c.secuencia,saldo=c.saldoCentavos,hash=c.hashUltimo;
   const ids=new Set();
   for(const m of asientosDesdeCheckpoint){
    if(!m||m.empresaId!==empresaId||m.sedeId!==sedeId||
       m.secuencia!==sec+1||m.hashAnterior!==hash||
       m.antesCentavos!==saldo||m.deletedAt!==null||
       !Number.isSafeInteger(m.montoCentavos)||m.montoCentavos<=0||
       !["CREDITO","DEBITO"].includes(m.tipo)||
       typeof m.operacionId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(m.operacionId)||
       ids.has(m.operacionId)||hashAsiento(m)!==m.hash)
     throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
    const next=BigInt(saldo)+(m.tipo==="CREDITO"?1n:-1n)*BigInt(m.montoCentavos);
    if(next<0n||next>BigInt(Number.MAX_SAFE_INTEGER)||m.despuesCentavos!==Number(next))
     throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
    ids.add(m.operacionId);sec=m.secuencia;saldo=m.despuesCentavos;hash=m.hash;
   }
   if(sec!==ancla.secuencia||saldo!==ancla.saldoCentavos||hash!==ancla.hashUltimo)
    throw Error("LEDGER_ANCLA_CONTINUIDAD_INVALIDA");
  }
 }
 if(secuenciaMinimaConfiable!==undefined&&ancla.secuencia<secuenciaMinimaConfiable)
  throw Error("LEDGER_ANCLA_RETROCESO_DETECTADO");
 return ancla;
}
module.exports={recuperarAnclaExternaConfiable};
