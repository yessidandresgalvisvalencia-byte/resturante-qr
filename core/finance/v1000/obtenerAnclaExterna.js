"use strict";
const {verificarAnclaConClaveFijada}=require("./anclaLedger");

/**
 * Contract for externally obtained, immutable evidence.
 * The provider is injected by the auditor, never created from ledger data.
 * No database persistence, network client or signing key is implied here.
 */
async function recuperarAnclaExternaConfiable({empresaId,sedeId,provider,llavePublicaPem,huellaAutorizada}){
 if(!provider||typeof provider.obtenerUltimaAncla!=="function")
  throw Error("LEDGER_ANCLA_PROVEEDOR_EXTERNO_REQUERIDO");
 if(!provider.separacionDePrivilegiosVerificada||provider.separacionDePrivilegiosVerificada!==true)
  throw Error("LEDGER_ANCLA_CUSTODIA_NO_CERTIFICADA");
 if(typeof provider.almacenamientoInmutableVerificado!=="boolean"||!provider.almacenamientoInmutableVerificado)
  throw Error("LEDGER_ANCLA_ALMACENAMIENTO_NO_CERTIFICADO");
 const ancla=await provider.obtenerUltimaAncla({empresaId,sedeId});
 if(!ancla)throw Error("LEDGER_ANCLA_EXTERNA_AUSENTE");
 verificarAnclaConClaveFijada({ancla,llavePublicaPem,huellaAutorizada,empresaId,sedeId});
 return ancla;
}
module.exports={recuperarAnclaExternaConfiable};
