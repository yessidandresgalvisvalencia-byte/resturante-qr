"use strict";
const crypto=require("node:crypto");
function hashAsiento(m){
 const fecha=m.timestamp instanceof Date?m.timestamp.toISOString():m.timestamp;
 const campos=[m.empresaId,m.sedeId,m.id,m.operacionId,m.tipo,String(m.montoCentavos),
 String(m.antesCentavos),String(m.despuesCentavos),String(m.secuencia),m.actorId,m.ip,
 fecha,m.hashAnterior];
 return crypto.createHash("sha256").update(campos.join("|")).digest("hex");
}
function verificarCadena({empresaId,sedeId,asientos,cabecera}){
 if(!Array.isArray(asientos)||!cabecera||!Number.isSafeInteger(cabecera.secuencia))throw Error("LEDGER_AUDITORIA_INVALIDA");
 let saldo=0,previo="0".repeat(64);
 const operaciones=new Set();
 for(let i=0;i<asientos.length;i++){
  const m=asientos[i];
  if(m.empresaId!==empresaId||m.sedeId!==sedeId||m.secuencia!==i+1||
     !Number.isSafeInteger(m.montoCentavos)||m.montoCentavos<=0||
     !Number.isSafeInteger(m.antesCentavos)||!Number.isSafeInteger(m.despuesCentavos)||
     m.antesCentavos!==saldo||m.hashAnterior!==previo||m.deletedAt!==null||
     !["CREDITO","DEBITO"].includes(m.tipo))throw Error("LEDGER_AUDITORIA_INCONSISTENTE");
  if(typeof m.operacionId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(m.operacionId)||
     operaciones.has(m.operacionId))throw Error("LEDGER_AUDITORIA_OPERACION_DUPLICADA");
  operaciones.add(m.operacionId);
  const next=BigInt(saldo)+(m.tipo==="CREDITO"?1n:-1n)*BigInt(m.montoCentavos);
  if(next<0n||next>BigInt(Number.MAX_SAFE_INTEGER)||Number(next)!==m.despuesCentavos||
     hashAsiento(m)!==m.hash)throw Error("LEDGER_AUDITORIA_INCONSISTENTE");
  saldo=m.despuesCentavos;previo=m.hash;
 }
 if(cabecera.secuencia!==asientos.length||cabecera.saldoCentavos!==saldo||cabecera.hashUltimo!==previo)
  throw Error("LEDGER_AUDITORIA_CABECERA_DIVERGENTE");
 return {ok:true,secuencia:asientos.length,saldoCentavos:saldo,hashUltimo:previo};
}
module.exports={hashAsiento,verificarCadena};
