"use strict";
const mongoose=require("mongoose");
const {tenant}=require("../core/finance/v1000/validation");
const {crearVerificadorCadena}=require("../core/finance/v1000/auditarLedger");
const Movimiento=require("../models/MovimientoLedgerV1000");
const Saldo=require("../models/SaldoLedgerV1000");

// Financial reconciliation is fail-closed; it must never silently truncate history.
async function auditarLedgerEnMongo({empresaId,sedeId,maxAsientos=10000}){
 tenant.parse({empresaId,sedeId});
 if(!Number.isSafeInteger(maxAsientos)||maxAsientos<1||maxAsientos>100000)
   throw Error("LEDGER_AUDITORIA_LIMITE_INVALIDO");
 const session=await mongoose.startSession();
 try{
  let auditoria;
  // A single snapshot prevents a payment committed between the head and
  // history reads from causing a spurious reconciliation mismatch.
  await session.withTransaction(async()=>{
   const head=await Saldo.findOne({empresaId,sedeId}).session(session).lean();
   if(!head)throw Error("LEDGER_AUDITORIA_CABECERA_AUSENTE");
   if(!Number.isSafeInteger(head.secuencia)||head.secuencia<0||head.secuencia>maxAsientos)
     throw Error("LEDGER_AUDITORIA_REQUIERE_PARTICION");
   const verificador=crearVerificadorCadena({empresaId,sedeId});
   const cursor=Movimiento.find({empresaId,sedeId}).sort({secuencia:1})
     .limit(maxAsientos+1).session(session).lean().cursor({batchSize:500});
   let total=0;
   try{
    for await(const asiento of cursor){
     if(++total>maxAsientos)throw Error("LEDGER_AUDITORIA_REQUIERE_PARTICION");
     verificador.agregar(asiento);
    }
   }finally{await cursor.close();}
   auditoria=verificador.finalizar(head);
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return auditoria;
 }finally{
  await session.endSession();
 }
}
module.exports={auditarLedgerEnMongo};
