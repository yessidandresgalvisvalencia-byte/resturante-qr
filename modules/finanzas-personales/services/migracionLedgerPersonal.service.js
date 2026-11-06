"use strict";
const crypto=require("crypto"),mongoose=require("mongoose");
const Movimiento=require("../models/movimiento.model"),Transaccion=require("../models/TransaccionPersonal"),Migracion=require("../models/migracionPersonal.model");
const {serializarEscrituraFuente}=require("./proteccionOriginalCompensadoPersonal.service");
const VERSION="movimientos-v1",MAX_FILAS=5000;
const config={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
const problema=(m,statusCode=409)=>Object.assign(new Error(m),{statusCode});
function hmac(userId,id){const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw problema("Servicio de idempotencia no configurado",503);return crypto.createHmac("sha256",secret).update(String(userId)+":legacy:"+String(id)).digest("hex");}
function minor(monto){
 if(typeof monto!=="number"||!Number.isSafeInteger(monto)||monto<1)throw problema("Monto legacy no representable como COP enteros; requiere revisión",422);
 return monto;
}
function exacto(n){if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))throw problema("Totales de migración fuera de rango seguro",422);return Number(n);}
function texto(v,max){if(typeof v!=="string"||!v.trim()||v!==v.trim()||v.length>max)throw problema("Texto legacy no verificable",422);return v;}
function preparar(uid,x){
 if(String(x.userId)!==String(uid)||!["INGRESO","GASTO"].includes(x.tipo)||!(x.fecha instanceof Date)||!Number.isFinite(+x.fecha))throw problema("Fuente legacy no verificable",422);
 const subcategoria=x.subcategoria??"";
 if(typeof subcategoria!=="string"||subcategoria.length>80||subcategoria!==subcategoria.trim())throw problema("Subcategoría legacy no verificable",422);
 // Mantener el contrato y HMAC de movimientos-v1: no duplicar importaciones previas.
 return {usuarioId:uid,tipo:x.tipo,montoMinor:minor(x.monto),moneda:"COP",concepto:texto(x.concepto,140),categoria:texto(x.categoria,80),
  subcategoria,fecha:x.fecha,origen:"SISTEMA",externalIdHash:hmac(uid,x._id)};
}
function coincide(a,b){return String(a.usuarioId)===String(b.usuarioId)&&
 ["tipo","montoMinor","moneda","concepto","categoria","subcategoria","origen","externalIdHash"].every(k=>a[k]===b[k])&&
 a.fecha instanceof Date&&+a.fecha===+b.fecha;}
function reporte(fuentes,ledger){
 const porHash=new Map();let li=0n,lg=0n,ni=0n,ng=0n;
 for(const x of ledger){
  if(porHash.has(x.externalIdHash))throw problema("Asientos importados duplicados");porHash.set(x.externalIdHash,x);
  const n=BigInt(minor(x.montoMinor));if(x.tipo==="INGRESO")ni+=n;else if(x.tipo==="GASTO")ng+=n;else throw problema("Tipo de asiento importado incompatible");
 }
 let identicas=ledger.length===fuentes.length;
 for(const f of fuentes){const n=BigInt(f.montoMinor);if(f.tipo==="INGRESO")li+=n;else lg+=n;const x=porHash.get(f.externalIdHash);if(!x||!coincide(x,f))identicas=false;}
 const diferencia=(ni-ng)-(li-lg);
 return {estado:identicas&&diferencia===0n?"RECONCILIADA":"ERROR",legacyCount:fuentes.length,ledgerCount:ledger.length,
  legacyIngresosMinor:exacto(li),legacyGastosMinor:exacto(lg),ledgerIngresosMinor:exacto(ni),ledgerGastosMinor:exacto(ng),diferenciaMinor:exacto(diferencia),
  detalle:identicas&&diferencia===0n?"Campos importados de las fuentes legacy presentes verificados; no acredita caja ni completitud histórica.":"Fuentes y asientos importados no coinciden; originales preservados."};
}
function indiceSeguro(indices,campos,{parcial=false}={}){
 return Array.isArray(indices)&&indices.some(i=>i.unique===true&&i.sparse!==true&&(!i.collation||i.collation.locale==="simple")&&
  Object.keys(i.key||{}).length===campos.length&&campos.every(k=>i.key[k]===1)&&
  (parcial?Object.keys(i.partialFilterExpression||{}).length===1&&
   Object.keys(i.partialFilterExpression?.externalIdHash||{}).length===1&&i.partialFilterExpression.externalIdHash.$type==="string":!i.partialFilterExpression));
}
async function exigirIndices(){
 let tx,migraciones;
 try{tx=await Transaccion.collection.indexes();migraciones=await Migracion.collection.indexes();}
 catch{throw problema("Índices de migración no verificables",503);}
 if(!indiceSeguro(tx,["usuarioId","externalIdHash"],{parcial:true})||!indiceSeguro(migraciones,["usuarioId","version"]))throw problema("Índices únicos de migración no verificados",503);
}
async function leer(uid,session){
 const legacy=await Movimiento.find({userId:uid}).sort({_id:1}).limit(MAX_FILAS+1).maxTimeMS(5000).session(session).lean();
 if(legacy.length>MAX_FILAS)throw problema("Migración excede el límite verificable",422);
 const fuentes=legacy.map(x=>preparar(uid,x));
 const hashes=fuentes.map(x=>x.externalIdHash);
 const ledger=hashes.length?await Transaccion.find({usuarioId:uid,externalIdHash:{$in:hashes}}).limit(MAX_FILAS+1).maxTimeMS(5000).session(session).lean():[];
 if(ledger.length>MAX_FILAS)throw problema("Ledger excede el límite verificable",422);
 reporte(fuentes,ledger); // Validar rangos antes de cualquier inserción.
 return {fuentes,ledger};
}
async function ejecutar(usuarioId,insertar){
 if(!mongoose.isObjectIdOrHexString(usuarioId))throw problema("Usuario inválido",400);
 const uid=new mongoose.Types.ObjectId(usuarioId);await exigirIndices();
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  await serializarEscrituraFuente(uid,session);
  const {fuentes,ledger}=await leer(uid,session),porHash=new Map(ledger.map(x=>[x.externalIdHash,x]));
  if(insertar){
   for(const f of fuentes){
    const existente=porHash.get(f.externalIdHash);
    if(existente){if(!coincide(existente,f))throw problema("Asiento previo distinto de su fuente; requiere auditoría sin sobrescribirlo");continue;}
    const [nuevo]=await Transaccion.create([f],{session});ledger.push(nuevo.toObject());
   }
  }
  const datos=reporte(fuentes,ledger);
  return Migracion.findOneAndUpdate({usuarioId:uid,version:VERSION},{$set:datos,$setOnInsert:{usuarioId:uid,version:VERSION}},
   {upsert:true,returnDocument:"after",runValidators:true,session});
 },config);}catch(e){if(e.code===11000)throw problema("Migración concurrente; vuelve a consultar antes de reintentar");throw e;}
 finally{await session.endSession();}
}
const migrar=usuarioId=>ejecutar(usuarioId,true),reconciliar=usuarioId=>ejecutar(usuarioId,false);
module.exports={migrar,reconciliar,VERSION,minor,reporte,indiceSeguro};
