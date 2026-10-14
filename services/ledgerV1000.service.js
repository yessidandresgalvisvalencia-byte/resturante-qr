"use strict";
const crypto=require("node:crypto");
const {hashAsiento}=require("../core/finance/v1000/auditarLedger");
const mongoose=require("mongoose");
const Saldo=require("../models/SaldoLedgerV1000");
const Movimiento=require("../models/MovimientoLedgerV1000");
const {movimiento,tenant,ulid}=require("../core/finance/v1000/validation");
const ALPHABET="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function generarUlid(){
 let v=BigInt(Date.now());
 let time="";
 for(let i=0;i<10;i++){time=ALPHABET[Number(v%32n)]+time;v/=32n;}
 let random="";
 const bytes=crypto.randomBytes(16);
 let bits=BigInt("0x"+bytes.toString("hex"));
 for(let i=0;i<16;i++){random=ALPHABET[Number(bits%32n)]+random;bits/=32n;}
 return time+random;
}
const hashMovimiento=hashAsiento;
async function registrarMovimiento({empresaId,sedeId,tipo,montoCentavos,actorId,ip}){
 tenant.parse({empresaId,sedeId});
 ulid.parse(actorId);
 if(!["CREDITO","DEBITO"].includes(tipo)||!Number.isSafeInteger(montoCentavos)||montoCentavos<=0)throw Error("LEDGER_IMPORTE_INVALIDO");
 if(typeof ip!=="string"||!ip.trim())throw Error("LEDGER_IP_INVALIDA");
 // No permita registrar una IP inválida en la bitácora financiera.
 const {z}=require("zod");
 z.string().ip().parse(ip);
 const session=await mongoose.startSession();
 try{
  let registrado;
  await session.withTransaction(async()=>{
   // One balance head per tenant and branch. A conditional update serializes
   // writes; transaction write conflicts force the driver to retry.
   await Saldo.updateOne({empresaId,sedeId},{$setOnInsert:{saldoCentavos:0,hashUltimo:"0".repeat(64),secuencia:0}},{upsert:true,session});
   const head=await Saldo.findOne({empresaId,sedeId}).session(session).lean();
   if(!head)throw Error("LEDGER_CABECERA_AUSENTE");
   // Fail closed if the cached head was corrupted, truncated or tampered with.
   if(!Number.isSafeInteger(head.saldoCentavos)||head.saldoCentavos<0||
      !Number.isSafeInteger(head.secuencia)||head.secuencia<0||
      head.secuencia>=Number.MAX_SAFE_INTEGER||
      typeof head.hashUltimo!=="string"||!/^[a-f0-9]{64}$/.test(head.hashUltimo)){
     throw Error("LEDGER_CABECERA_INVALIDA");
   }
   if(head.secuencia===0){
     if(head.saldoCentavos!==0||head.hashUltimo!=="0".repeat(64))
       throw Error("LEDGER_GENESIS_INCONSISTENTE");
   }else{
     const last=await Movimiento.findOne({empresaId,sedeId,secuencia:head.secuencia}).session(session).lean();
     if(!last||last.hash!==head.hashUltimo||last.despuesCentavos!==head.saldoCentavos||
        hashMovimiento({...last,timestamp:new Date(last.timestamp).toISOString()})!==last.hash)
       throw Error("LEDGER_CADENA_INCONSISTENTE");
   }
   const antes=BigInt(head.saldoCentavos),delta=BigInt(montoCentavos);
   const despues=tipo==="CREDITO"?antes+delta:antes-delta;
   if(despues<0n||despues>BigInt(Number.MAX_SAFE_INTEGER))throw Error("LEDGER_SALDO_INVALIDO");
   const timestamp=new Date().toISOString();
   const doc={id:generarUlid(),empresaId,sedeId,tipo,montoCentavos,secuencia:head.secuencia+1,
     antesCentavos:Number(antes),despuesCentavos:Number(despues),
     actorId,ip,timestamp,hashAnterior:head.hashUltimo,deletedAt:null};
   doc.hash=hashMovimiento(doc);
   movimiento.parse(doc);
   const updated=await Saldo.updateOne({_id:head._id,secuencia:head.secuencia,hashUltimo:head.hashUltimo},
     {$set:{saldoCentavos:doc.despuesCentavos,hashUltimo:doc.hash},$inc:{secuencia:1}},{session});
   if(updated.modifiedCount!==1)throw Error("LEDGER_CONFLICTO_CONCURRENCIA");
   await Movimiento.create([doc],{session});
   registrado=doc;
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return registrado;
 }finally{await session.endSession();}
}
module.exports={registrarMovimiento,generarUlid,hashMovimiento};
