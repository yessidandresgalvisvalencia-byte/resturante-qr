"use strict";
const {verificarAnclaConClaveFijada}=require("./anclaLedger");

/**
 * Contract for externally obtained, immutable evidence.
 * The provider is injected by the auditor, never created from ledger data.
 * No database persistence, network client or signing key is implied here.
 */
async function recuperarAnclaExternaConfiable({empresaId,sedeId,provider,llavePublicaPem,huellaAutorizada,secuenciaMinimaConfiable}){
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
 if(secuenciaMinimaConfiable!==undefined&&ancla.secuencia<secuenciaMinimaConfiable)
  throw Error("LEDGER_ANCLA_RETROCESO_DETECTADO");
 return ancla;
}
module.exports={recuperarAnclaExternaConfiable};
