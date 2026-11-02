"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {MongoClient,BSON}=require("mongoose").mongo;
const {COLECCIONES,crearRespaldo,cifrar,descifrar,restaurarEnEnsayo}=require("../../../modules/finanzas-personales/services/respaldoFinancieroPersonal.service");
async function probarRespaldoFinancieroAutorizado({db,uri,password}){
 const reader=new MongoClient(uri,{auth:{username:"reader",password},authSource:db.databaseName,directConnection:true,serverSelectionTimeoutMS:5000});
 const clave=crypto.randomBytes(32),destino="gruk_v81_restore_test_"+crypto.randomBytes(8).toString("hex"),usuario="restore_"+crypto.randomBytes(5).toString("hex"),secreto=crypto.randomBytes(24).toString("hex");
 try{
  await reader.connect();const origen=reader.db(db.databaseName);
  await assert.rejects(origen.collection(COLECCIONES[0]).updateOne({_id:"sin-coincidencia"},{$set:{valor:1}}),e=>e.code===13);
  const conteos=async()=>Promise.all(COLECCIONES.map(async n=>[n,await origen.collection(n).countDocuments({})]));
  const antes=await conteos(),respaldo=await crearRespaldo({cliente:reader,base:db.databaseName,clave,retenerHasta:new Date(Date.now()+7*86400000).toISOString()});
  assert.deepEqual(await conteos(),antes);assert.equal(respaldo.resumen.certificaCustodiaIndependiente,false);
  const payload=descifrar(respaldo.archivo,clave);
  assert.equal(payload.colecciones.length,12);assert.equal(respaldo.resumen.documentos,antes.reduce((n,[,c])=>n+c,0));
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"gruk-backup-ensayo-")),archivo=path.join(dir,"respaldo.aesgcm.json");
  await fs.writeFile(archivo,respaldo.archivo,{mode:0o600,flag:"wx"});
  assert.equal((await fs.stat(archivo)).mode&0o777,0o600);
  await assert.rejects(fs.writeFile(archivo,Buffer.from("no sobrescribir"),{flag:"wx"}),e=>e.code==="EEXIST");
  assert.deepEqual(await fs.readFile(archivo),respaldo.archivo);
  // Credencial de restauración distinta, limitada a la base nueva del ensayo.
  const objetivo=db.client.db(destino);
  await objetivo.command({createUser:usuario,pwd:secreto,roles:[{role:"readWrite",db:destino}]});
  const post=new BSON.ObjectId();
  await db.collection("fin_cuentas_personales").insertOne({_id:post,usuarioId:new BSON.ObjectId(),nombre:"Posterior a captura",saldoMinor:0});
  const resultado=await restaurarEnEnsayo({uri:"mongodb://127.0.0.1:27018/"+destino,auth:{username:usuario,password:secreto},archivo:await fs.readFile(archivo),clave});
  assert.equal(resultado.verificado,true);assert.equal(resultado.documentos,respaldo.resumen.documentos);assert.equal(resultado.colecciones,12);
  assert.equal(await objetivo.collection("fin_cuentas_personales").countDocuments({_id:post}),0);
  assert.equal(resultado.certificaRpoProduccion,false);assert.equal(resultado.certificaCustodiaIndependiente,false);
  assert.ok(resultado.restauracionMs>=0);assert.ok(resultado.edadRespaldoMs>=0);
  const guard=await objetivo.collection("__gruk_restore_guard").findOne({_id:"ensayo"});assert.equal(guard.estado,"VERIFICADO");
  const antesReintento=await objetivo.collection("fin_transacciones_personales").countDocuments({});
  await assert.rejects(restaurarEnEnsayo({uri:"mongodb://127.0.0.1:27018/"+destino,auth:{username:usuario,password:secreto},archivo:respaldo.archivo,clave}),/completamente vacía/);
  assert.equal(await objetivo.collection("fin_transacciones_personales").countDocuments({}),antesReintento);
  // Paquete de ensayo autenticado pero con _id duplicado: falla al insertar,
  // conserva la cuarentena y no permite reintentar sobre el destino parcial.
  const parcial="gruk_v81_restore_test_"+crypto.randomBytes(8).toString("hex"),usuarioParcial=usuario+"_fallo",claveParcial=crypto.randomBytes(24).toString("hex");
  const dbParcial=db.client.db(parcial);
  await dbParcial.command({createUser:usuarioParcial,pwd:claveParcial,roles:[{role:"readWrite",db:parcial}]});
  const mal=descifrar(respaldo.archivo,clave),primera=mal.colecciones[0];assert.ok(primera.documentos.length);
  primera.documentos.push(primera.documentos[0]);
  const hashMal=crypto.createHash("sha256");for(const raw of primera.documentos)hashMal.update(Buffer.from(raw,"base64"));primera.hash=hashMal.digest("hex");
  const defectuoso=cifrar(mal,clave),destinoParcial={uri:"mongodb://127.0.0.1:27018/"+parcial,auth:{username:usuarioParcial,password:claveParcial},archivo:defectuoso,clave};
  await assert.rejects(restaurarEnEnsayo(destinoParcial),e=>e.code==="RESPALDO_PERSONAL_RECHAZADO"&&!e.message.includes("E11000"));
  assert.equal((await dbParcial.collection("__gruk_restore_guard").findOne({_id:"ensayo"})).estado,"INCOMPLETO");
  const cantidadParcial=await dbParcial.collection(COLECCIONES[0]).countDocuments({});
  await assert.rejects(restaurarEnEnsayo(destinoParcial),/completamente vacía/);
  assert.equal(await dbParcial.collection(COLECCIONES[0]).countDocuments({}),cantidadParcial);
  // Sin borrar origen, destino ni paquete: el contenedor y tmp son efímeros de CI.
  console.log("RESPALDO_ENSAYO_METRICAS "+JSON.stringify({colecciones:resultado.colecciones,documentos:resultado.documentos,
   capturaMs:respaldo.resumen.capturaMs,restauracionMs:resultado.restauracionMs,edadRespaldoMs:resultado.edadRespaldoMs,
   bytes:respaldo.resumen.bytes,custodiaIndependiente:false,rpoProduccion:false}));
 }finally{clave.fill(0);await reader.close();}
}
module.exports={probarRespaldoFinancieroAutorizado};
