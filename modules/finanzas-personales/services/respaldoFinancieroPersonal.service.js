"use strict";
const crypto=require("node:crypto"),{performance}=require("node:perf_hooks");
const {MongoClient,BSON}=require("mongoose").mongo;
const COLECCIONES=Object.freeze([
 "fin_transacciones_personales","fin_eventos_compensatorios_personales_v1","decisionproofpersonals",
 "fin_eventos_v81","fin_vinculos_historicos_v81","fin_cursor_compensaciones_personales_v1",
 "fin_cuentas_personales","fin_reservas_cuotas_recurrentes","fin_prestamos_personales",
 "fin_compromisos_cuotas","fin_compromisos_cuotas_hijas","fin_outbox_personal"
]);
const MAX_DOCS=5000,MAX_BYTES=16*1024*1024,AAD=Buffer.from("GRUK_PERSONAL_BACKUP_V1");
const iso=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const problema=m=>Object.assign(new Error(m),{code:"RESPALDO_PERSONAL_RECHAZADO"});
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function claveValida(clave){if(!Buffer.isBuffer(clave)||clave.length!==32)throw problema("Clave independiente de 32 bytes requerida");}
function validarContenido(p){
 if(!p||p.version!==1||!Array.isArray(p.colecciones)||p.colecciones.length!==COLECCIONES.length||
  new Set(p.colecciones.map(c=>c.nombre)).size!==COLECCIONES.length||
  !iso(p.inicio)||!iso(p.fin)||Date.parse(p.fin)<Date.parse(p.inicio)||
  !iso(p.retenerHasta)||Date.parse(p.retenerHasta)<=Date.parse(p.fin))throw problema("Manifiesto de respaldo inválido");
 for(const c of p.colecciones){
  if(!COLECCIONES.includes(c.nombre)||!Array.isArray(c.documentos)||c.documentos.length>MAX_DOCS||
   !Array.isArray(c.indices)||c.indices.length>100||typeof c.hash!=="string")throw problema("Colección fuera del alcance verificable");
  if(new Set(c.indices.map(i=>i.name)).size!==c.indices.length||!c.indices.some(i=>i.name==="_id_"&&JSON.stringify(i.key)==='{"_id":1}'))throw problema("Índices del respaldo inválidos");
  for(const i of c.indices)if(typeof i.name!=="string"||!i.key||!Object.keys(i.key).length||
   Object.values(i.key).some(v=>![1,-1,"hashed"].includes(v))||i.expireAfterSeconds!==undefined)
   throw problema("Índice con formato no admitido o TTL prohibido en este alcance");
  const h=crypto.createHash("sha256");
  for(const raw of c.documentos){
   if(typeof raw!=="string"||!raw||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw problema("Documento de respaldo inválido");
   const b=Buffer.from(raw,"base64");
   if(b.toString("base64")!==raw||b.length<5||b.readInt32LE(0)!==b.length||b.at(-1)!==0)throw problema("Documento BSON inválido");
   h.update(b);
  }
  if(h.digest("hex")!==c.hash)throw problema("Hash del respaldo no coincide");
 }
 return p;
}
function cifrar(p,clave){
 claveValida(clave);validarContenido(p);
 const raw=Buffer.from(JSON.stringify(p));if(raw.length>MAX_BYTES)throw problema("Respaldo supera capacidad verificable");
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv("aes-256-gcm",clave,iv);c.setAAD(AAD);
 return Buffer.from(JSON.stringify({version:1,algoritmo:"AES-256-GCM",iv:iv.toString("base64"),
  cifrado:Buffer.concat([c.update(raw),c.final()]).toString("base64"),etiqueta:c.getAuthTag().toString("base64")}));
}
function descifrar(archivo,clave){
 claveValida(clave);
 if(!Buffer.isBuffer(archivo)||archivo.length>MAX_BYTES*2)throw problema("Archivo de respaldo inválido");
 try{
  const p=JSON.parse(archivo.toString());
  if(p.version!==1||p.algoritmo!=="AES-256-GCM")throw Error();
  const iv=Buffer.from(p.iv,"base64"),tag=Buffer.from(p.etiqueta,"base64");
  if(iv.length!==12||tag.length!==16)throw Error();
  const d=crypto.createDecipheriv("aes-256-gcm",clave,iv);d.setAAD(AAD);d.setAuthTag(tag);
  const raw=Buffer.concat([d.update(Buffer.from(p.cifrado,"base64")),d.final()]);
  if(raw.length>MAX_BYTES)throw Error();
  return validarContenido(JSON.parse(raw.toString()));
 }catch{throw problema("No se pudo autenticar o validar el respaldo");}
}
function indicesNormales(indices){
 return indices.map(i=>({key:i.key,name:i.name,...Object.fromEntries(
  ["unique","sparse","partialFilterExpression","expireAfterSeconds","collation","hidden"].filter(k=>i[k]!==undefined).map(k=>[k,i[k]]))
 })).sort((a,b)=>a.name.localeCompare(b.name));
}
async function catalogo(db){
 const rows=await db.listCollections({name:{$in:COLECCIONES}},{nameOnly:false,maxTimeMS:5000}).toArray();
 if(rows.length!==COLECCIONES.length||rows.some(c=>c.type!=="collection"||Object.keys(c.options||{}).length))
  throw problema("Se requieren todas las colecciones ordinarias del alcance sin opciones especiales");
 return BSON.EJSON.stringify(rows.map(c=>({nombre:c.name,uuid:c.info?.uuid})).sort((a,b)=>a.nombre.localeCompare(b.nombre)),{relaxed:false});
}
async function crearRespaldo({cliente,base,clave,retenerHasta}){
 claveValida(clave);
 if(!cliente||typeof base!=="string"||!base||!iso(retenerHasta)||Date.parse(retenerHasta)<=Date.now())
  throw problema("Conexión, base y retención explícitas requeridas");
 const inicio=new Date(),t=performance.now(),db=cliente.db(base),antes=await catalogo(db),indices={};
 for(const nombre of COLECCIONES)indices[nombre]=indicesNormales(await db.collection(nombre).listIndexes({maxTimeMS:5000}).toArray());
 const session=cliente.startSession();let colecciones;
 try{
  await session.withTransaction(async()=>{
   const resultado=[];let bytes=0;
   for(const nombre of COLECCIONES){
    const cursor=db.collection(nombre).find({},{session,raw:true,limit:MAX_DOCS+1,maxTimeMS:5000}).sort({_id:1});
    const hash=crypto.createHash("sha256"),documentos=[];
    try{for await(const raw of cursor){
     if(!Buffer.isBuffer(raw)||documentos.length>=MAX_DOCS)throw problema("Lectura de respaldo incompleta o no BSON");
     bytes+=raw.length;if(bytes>MAX_BYTES)throw problema("Respaldo supera capacidad verificable");
     hash.update(raw);documentos.push(raw.toString("base64"));
    }}finally{await cursor.close();}
    resultado.push({nombre,indices:indices[nombre],documentos,hash:hash.digest("hex")});
   }
   colecciones=resultado;
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
 }finally{await session.endSession();}
 if(antes!==await catalogo(db))throw problema("El catálogo cambió durante la captura");
 for(const nombre of COLECCIONES)if(JSON.stringify(indices[nombre])!==JSON.stringify(indicesNormales(await db.collection(nombre).listIndexes({maxTimeMS:5000}).toArray())))
  throw problema("Los índices cambiaron durante la captura");
 const fin=new Date(),payload={version:1,inicio:inicio.toISOString(),fin:fin.toISOString(),retenerHasta,colecciones};
 const archivo=cifrar(payload,clave);
 return {archivo,resumen:{sha256:sha(archivo),colecciones:colecciones.length,documentos:colecciones.reduce((n,c)=>n+c.documentos.length,0),
  bytes:archivo.length,capturaMs:Math.ceil(performance.now()-t),retenerHasta,certificaCustodiaIndependiente:false}};
}
function validarDestino(uri,env=process.env.NODE_ENV){
 let u;try{u=new URL(uri);}catch{throw problema("Destino de ensayo inválido");}
 if(env==="production"||u.protocol!=="mongodb:"||u.hostname!=="127.0.0.1"||u.port!=="27018"||
  !/^\/gruk_v81_restore_test_[a-f0-9]{16}$/.test(u.pathname)||u.username||u.password||u.search||u.hash)
  throw problema("Restauración limitada a base nueva de ensayo en loopback:27018");
 return u.pathname.slice(1);
}
async function restaurarEnEnsayo({uri,auth,archivo,clave}){
 const base=validarDestino(uri),p=descifrar(archivo,clave),t=performance.now();
 const cliente=new MongoClient(uri,{auth,authSource:base,directConnection:true,serverSelectionTimeoutMS:5000});
 try{
  await cliente.connect();const db=cliente.db(base);
  if((await db.listCollections({},{nameOnly:true}).toArray()).length)throw problema("La base de ensayo debe estar completamente vacía");
  // createCollection actúa como reclamación exclusiva. Un error deja el destino
  // en cuarentena, sin borrar nada ni sobrescribir una base preexistente.
  await db.createCollection("__gruk_restore_guard");
  const guard=db.collection("__gruk_restore_guard");
  await guard.insertOne({_id:"ensayo",estado:"INCOMPLETO",archivoHash:sha(archivo)});
  for(const c of p.colecciones){
   await db.createCollection(c.nombre);
   for(const i of c.indices)if(i.name!=="_id_"){
    const {key,...opciones}=i;await db.collection(c.nombre).createIndex(key,opciones);
   }
   if(c.documentos.length)await db.collection(c.nombre).insertMany(c.documentos.map(raw=>BSON.deserialize(Buffer.from(raw,"base64"),{promoteValues:false})),{ordered:true});
   const rows=await db.collection(c.nombre).find({},{raw:true,maxTimeMS:5000}).sort({_id:1}).toArray();
   const h=crypto.createHash("sha256");for(const b of rows)h.update(b);
   if(rows.length!==c.documentos.length||h.digest("hex")!==c.hash||
    JSON.stringify(indicesNormales(await db.collection(c.nombre).listIndexes({maxTimeMS:5000}).toArray()))!==JSON.stringify(c.indices))
    throw problema("Restauración no coincide con documentos o índices originales");
  }
  const restauracionMs=Math.ceil(performance.now()-t);
  await guard.updateOne({_id:"ensayo"},{$set:{estado:"VERIFICADO",restauracionMs}});
  return {verificado:true,colecciones:p.colecciones.length,documentos:p.colecciones.reduce((n,c)=>n+c.documentos.length,0),
   restauracionMs,edadRespaldoMs:Math.max(0,Date.now()-Date.parse(p.fin)),certificaRpoProduccion:false,certificaCustodiaIndependiente:false};
 }catch(e){
  if(e.code==="RESPALDO_PERSONAL_RECHAZADO")throw e;
  throw problema("No se pudo completar la restauración; conservar destino en cuarentena");
 }finally{await cliente.close();}
}
module.exports={COLECCIONES,crearRespaldo,restaurarEnEnsayo,validarDestino,cifrar,descifrar};
