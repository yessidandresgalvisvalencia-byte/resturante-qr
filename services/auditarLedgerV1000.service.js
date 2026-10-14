"use strict";
const {tenant}=require("../core/finance/v1000/validation");
const {verificarCadena}=require("../core/finance/v1000/auditarLedger");
const Movimiento=require("../models/MovimientoLedgerV1000");
const Saldo=require("../models/SaldoLedgerV1000");

// Financial reconciliation is fail-closed; it must never silently truncate history.
async function auditarLedgerEnMongo({empresaId,sedeId,maxAsientos=10000}){
 tenant.parse({empresaId,sedeId});
 if(!Number.isSafeInteger(maxAsientos)||maxAsientos<1||maxAsientos>100000)
   throw Error("LEDGER_AUDITORIA_LIMITE_INVALIDO");
 const head=await Saldo.findOne({empresaId,sedeId}).lean();
 if(!head)throw Error("LEDGER_AUDITORIA_CABECERA_AUSENTE");
 if(!Number.isSafeInteger(head.secuencia)||head.secuencia<0||head.secuencia>maxAsientos)
   throw Error("LEDGER_AUDITORIA_REQUIERE_PARTICION");
 const asientos=await Movimiento.find({empresaId,sedeId}).sort({secuencia:1}).limit(maxAsientos+1).lean();
 if(asientos.length>maxAsientos)throw Error("LEDGER_AUDITORIA_REQUIERE_PARTICION");
 return verificarCadena({empresaId,sedeId,asientos,cabecera:head});
}
module.exports={auditarLedgerEnMongo};
