"use strict";
const {calculateMovement}=require("./copAmounts");
const {hashMovement,ZERO_HASH}=require("./appendLedger.service");
function verifyLedgerChain({movements,head}) {
 if(!Array.isArray(movements) || !head || typeof head!=="object") throw new TypeError("LEDGER_INVALID_AUDIT_INPUT");
 if(!["empresaId","sedeId","cuentaId"].every(k=>typeof head[k]==="string" && head[k])) throw new Error("LEDGER_INVALID_SCOPE");
 let sequence=0,lastHash=ZERO_HASH,balance="0";
 for(const row of movements){
   if(!row || row.empresaId!==head.empresaId || row.sedeId!==head.sedeId || row.cuentaId!==head.cuentaId) throw new Error("LEDGER_SCOPE_MISMATCH");
   if(row.secuencia!==++sequence) throw new Error("LEDGER_SEQUENCE_BROKEN");
   if(row.hashAnterior!==lastHash) throw new Error("LEDGER_CHAIN_BROKEN");
   if(row.beforeCentavos!==balance) throw new Error("LEDGER_BALANCE_BROKEN");
   const expected=calculateMovement({beforeCentavos:balance,amountCentavos:row.amountCentavos,tipo:row.tipo});
   if(row.afterCentavos!==expected.afterCentavos) throw new Error("LEDGER_BALANCE_BROKEN");
   if(row.hash!==hashMovement(row)) throw new Error("LEDGER_HASH_BROKEN");
   balance=row.afterCentavos;lastHash=row.hash;
 }
 if(head.secuencia!==sequence || head.balanceCentavos!==balance || head.lastHash!==lastHash) throw new Error("LEDGER_HEAD_MISMATCH");
 return Object.freeze({valid:true,movimientos:sequence,balanceCentavos:balance,lastHash});
}
module.exports={verifyLedgerChain};
