"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const mongoose=require("mongoose");const crypto=require("crypto");
const registrar=require("../../modules/finanzas-personales/services/decisionProofPersistence.service").registrar;
const Proof=require("../../modules/finanzas-personales/models/decisionProofPersonal.model");
const Head=require("../../modules/finanzas-personales/models/decisionChainHeadPersonal.model");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");

function exigirMongoDePruebasLocal(uri, confirmacion) {
 if (confirmacion !== "SOLO_PRUEBAS_LOCALES") throw new Error("CONFIRMACION_DB_PRUEBAS_REQUERIDA");
 let destino;
 try { destino = new URL(uri); } catch { throw new Error("TEST_MONGO_URI_INVALIDA"); }
 const locales = new Set(["127.0.0.1", "[::1]"]);
 if (destino.protocol !== "mongodb:" || !locales.has(destino.hostname) ||
     !destino.port || destino.host.includes(",") ||
     destino.searchParams.get("directConnection") !== "true") {
  throw new Error("MONGO_PRUEBAS_NO_LOCAL");
 }
 return true;
}

test("DecisionProof serializa dos escrituras concurrentes sin huérfanos",{skip:!process.env.TEST_MONGO_URI},async()=>{
 exigirMongoDePruebasLocal(process.env.TEST_MONGO_URI,process.env.GRUK_TEST_DB_CONFIRM);
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_chain_concurrency"});
 try{
  // No se borran decisiones: cada ejecución crea un usuario único.
  await Promise.all([Proof.syncIndexes(),Head.syncIndexes(),Outbox.syncIndexes()]);
  const usuarioId=new mongoose.Types.ObjectId();
  const base={evaluacion:{autorizada:false,irreversible:false,motivos:[]},verdades:[],actorId:"TEST"};
  const [a,b]=await Promise.all([
   registrar(usuarioId,{...base,accion:"CONSULTAR",idempotencyKey:"race-key-0001"}),
   registrar(usuarioId,{...base,accion:"SIMULAR",idempotencyKey:"race-key-0002"})
  ]);
  assert.notEqual(a.hash,b.hash);
  const items=await Proof.find({usuarioId}).sort({secuencia:1}).lean();
  assert.deepEqual(items.map(x=>x.secuencia),[1,2]);
  assert.equal(items[0].previousHash,null);
  assert.equal(items[1].previousHash,items[0].hash);
  const head=await Head.findOne({usuarioId}).lean();
  assert.equal(head.secuencia,2);assert.equal(head.headHash,items[1].hash);
  const outbox=await Outbox.find({usuarioId,eventName:"DECISION_PROOF_REGISTRADA"}).lean();
  assert.equal(outbox.length,2);
  assert.deepEqual(new Set(outbox.map(x=>String(x.aggregateId))).size,2);
  // Misma clave, misma petición: solo una decisión y un evento outbox.
  const peticion={...base,accion:"CONSULTAR",idempotencyKey:"race-same-key-0003"};
  const [uno,dos]=await Promise.all([
   registrar(usuarioId,peticion),
   registrar(usuarioId,peticion)
  ]);
  assert.equal(String(uno._id),String(dos._id));
  assert.equal(await Proof.countDocuments({usuarioId,idempotencyKey:peticion.idempotencyKey}),1);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"DECISION_PROOF_REGISTRADA"}),3);
  const cadena=await Proof.find({usuarioId}).sort({secuencia:1}).lean();
  assert.deepEqual(cadena.map(x=>x.secuencia),[1,2,3]);
  assert.equal(cadena[2].previousHash,cadena[1].hash);
  // Misma clave, peticiones diferentes: no puede retornar una decisión ajena.
  const [izquierda,derecha]=await Promise.allSettled([
   registrar(usuarioId,{...base,accion:"CONSULTAR",idempotencyKey:"race-conflict-key-0004"}),
   registrar(usuarioId,{...base,accion:"SIMULAR",idempotencyKey:"race-conflict-key-0004"})
  ]);
  const exitos=[izquierda,derecha].filter(x=>x.status==="fulfilled");
  const rechazados=[izquierda,derecha].filter(x=>x.status==="rejected");
  assert.equal(exitos.length,1);
  assert.equal(rechazados.length,1);
  assert.equal(rechazados[0].reason.code,"IDEMPOTENCY_KEY_CONFLICT");
  assert.equal(await Proof.countDocuments({usuarioId,idempotencyKey:"race-conflict-key-0004"}),1);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"DECISION_PROOF_REGISTRADA"}),4);
  const final=await Proof.find({usuarioId}).sort({secuencia:1}).lean();
  assert.deepEqual(final.map(x=>x.secuencia),[1,2,3,4]);
  const headFinal=await Head.findOne({usuarioId}).lean();
  assert.equal(headFinal.headHash,final[3].hash);
  await assert.rejects(
    ()=>Proof.updateOne({usuarioId,_id:final[0]._id},{$set:{accion:"ADULTERADO"}}),
    {code:"DECISION_PROOF_APPEND_ONLY"}
  );
  await assert.rejects(
    ()=>Proof.deleteOne({usuarioId,_id:final[0]._id}),
    {code:"DECISION_PROOF_APPEND_ONLY"}
  );
  await assert.rejects(
    ()=>Proof.deleteMany({usuarioId}),
    {code:"DECISION_PROOF_APPEND_ONLY"}
  );
  await assert.rejects(
    ()=>Proof.replaceOne({usuarioId,_id:final[0]._id},{...final[0],accion:"REEMPLAZADO"}),
    {code:"DECISION_PROOF_APPEND_ONLY"}
  );
  await assert.rejects(
    ()=>Proof.bulkWrite([{updateOne:{filter:{_id:final[0]._id},update:{$set:{accion:"ADULTERADO"}}}}]),
    {code:"DECISION_PROOF_APPEND_ONLY"}
  );
  const existente=await Proof.findById(final[0]._id);
  existente.accion="ADULTERADO";
  await assert.rejects(()=>existente.save(),{code:"DECISION_PROOF_APPEND_ONLY"});
  assert.equal((await Proof.findById(final[0]._id)).accion,final[0].accion);

  const {auditarCadenaUsuario}=require("../../modules/finanzas-personales/services/auditoriaCadenaDecision.service");
  assert.deepEqual(await auditarCadenaUsuario(usuarioId),{valida:true,codigo:"OK",secuencia:4});
  const {emitirAnclaDecisionMongo,verificarAnclaDecisionMongo}=require("../../modules/finanzas-personales/services/anclaDecisionMongo.service");
  const {verificarAncla}=require("../../modules/finanzas-personales/security/anclaExternaDecision.service");
  const claveAncla=Buffer.alloc(32,0x71); // Solo para pruebas; jamás usar en producción.
  const anclaMongo=await emitirAnclaDecisionMongo(usuarioId,claveAncla);
  assert.equal(anclaMongo.secuencia,4);
  assert.equal(anclaMongo.headHash,headFinal.headHash);
  assert.equal(verificarAncla(anclaMongo,claveAncla,final,headFinal,String(usuarioId)).codigo,"ANCLA_VERIFICADA");
  assert.deepEqual(await verificarAnclaDecisionMongo(usuarioId,claveAncla,anclaMongo),{
    valida:true,codigo:"ANCLA_VERIFICADA",secuenciaAnclada:4
  });
  assert.deepEqual(await verificarAnclaDecisionMongo(usuarioId,claveAncla,{
    ...anclaMongo,firma:"0".repeat(64)
  }),{valida:false,codigo:"FIRMA_INVALIDA"});
  await assert.rejects(()=>verificarAnclaDecisionMongo(usuarioId,claveAncla,null),TypeError);

  // Continuidad externa: reemitir solo si el comprobante previamente
  // conservado fuera de MongoDB coincide con el historial actual.
  const reemitida=await emitirAnclaDecisionMongo(usuarioId,claveAncla,{anclaPrevia:anclaMongo});
  assert.equal(reemitida.secuencia,4);
  await assert.rejects(
    ()=>emitirAnclaDecisionMongo(usuarioId,claveAncla,{
      anclaPrevia:{...anclaMongo,headHash:"0".repeat(64)}
    }),
    {message:"CONTINUIDAD_ANCLA_INVALIDA",code:"FIRMA_INVALIDA"}
  );
  await assert.rejects(
    ()=>emitirAnclaDecisionMongo(usuarioId,claveAncla,{
      anclaPrevia:{...anclaMongo,usuarioId:String(new mongoose.Types.ObjectId())}
    }),
    {message:"CONTINUIDAD_ANCLA_INVALIDA",code:"FIRMA_INVALIDA"}
  );

  await assert.rejects(()=>emitirAnclaDecisionMongo(usuarioId,Buffer.alloc(4)),TypeError);

  const otroUsuario=new mongoose.Types.ObjectId();
  assert.deepEqual(await auditarCadenaUsuario(otroUsuario),{valida:false,codigo:"SIN_ANCLA_DE_INTEGRIDAD",secuencia:0});
  await assert.rejects(()=>emitirAnclaDecisionMongo(otroUsuario,claveAncla),/SIN_ANCLA_DE_INTEGRIDAD/);

  // Crear solo la cabeza en cero simula un reinicio del ledger: no prueba
  // que la cuenta haya estado siempre vacía y nunca debe aprobar auditoría.
  await Head.create({usuarioId:otroUsuario,secuencia:0,headHash:null});
  assert.deepEqual(await auditarCadenaUsuario(otroUsuario),{
    valida:false,codigo:"SIN_ANCLA_DE_INTEGRIDAD",secuencia:0
  });


  // Ataque completo en usuario temporal aislado: se borra toda la cadena
  // directamente desde MongoDB y se reinicia el head. Un head vacío jamás
  // constituye evidencia suficiente de integridad.
  const usuarioBorrado=new mongoose.Types.ObjectId();
  await registrar(usuarioBorrado,{
    ...base,accion:"CONSULTAR",idempotencyKey:"attack-delete-all-0001"
  });
  assert.deepEqual(await auditarCadenaUsuario(usuarioBorrado),{
    valida:true,codigo:"OK",secuencia:1
  });
  assert.equal((await Proof.collection.deleteMany({usuarioId:usuarioBorrado})).deletedCount,1);
  const reinicio=await Head.collection.updateOne(
    {usuarioId:usuarioBorrado},
    {$set:{secuencia:0,headHash:null}}
  );
  assert.equal(reinicio.matchedCount,1);
  assert.deepEqual(await auditarCadenaUsuario(usuarioBorrado),{
    valida:false,codigo:"SIN_ANCLA_DE_INTEGRIDAD",secuencia:0
  });

  // Un acceso privilegiado directo a MongoDB elude los hooks de Mongoose.
  // La prueba usa exclusivamente el usuario temporal generado arriba y
  // demuestra que la auditoría detecta la adulteración del historial.
  const alteracion=await Proof.collection.updateOne(
    {_id:final[0]._id,usuarioId},
    {$set:{accion:"ADULTERADO_POR_DB"}}
  );
  assert.equal(alteracion.modifiedCount,1);
  assert.deepEqual(await auditarCadenaUsuario(usuarioId),{
    valida:false,codigo:"HASH_INVALIDO",secuencia:1
  });
  await assert.rejects(()=>emitirAnclaDecisionMongo(usuarioId,claveAncla),{
    message:"CADENA_NO_VERIFICABLE",code:"HASH_INVALIDO"
  });
  assert.deepEqual(await verificarAnclaDecisionMongo(usuarioId,claveAncla,anclaMongo),{
    valida:false,codigo:"CADENA_INVALIDA"
  });

  await assert.rejects(()=>emitirAnclaDecisionMongo(usuarioId,claveAncla,{
    anclaPrevia:anclaMongo
  }),{message:"CONTINUIDAD_ANCLA_INVALIDA",code:"CADENA_INVALIDA"});





 }finally{await mongoose.disconnect();}
});

const { fingerprint, resolverExistente } = require("../../modules/finanzas-personales/services/decisionProofPersistence.service");

test("idempotencia: misma solicitud conserva la huella sin depender del orden de propiedades", () => {
 const a = {accion:"CONSULTAR", evaluacion:{autorizada:false, motivos:["CAJA_INSUFICIENTE"]}, verdades:[{tipo:"CAJA", montoMinor:1000}], actorId:"TEST"};
 const b = {actorId:"TEST", verdades:[{montoMinor:1000,tipo:"CAJA"}], evaluacion:{motivos:["CAJA_INSUFICIENTE"],autorizada:false},accion:"CONSULTAR"};
 assert.equal(fingerprint(a),fingerprint(b));
 const guardado={idempotencyKey:"misma-clave",requestFingerprint:fingerprint(a),hash:"abc"};
 assert.equal(resolverExistente(guardado,fingerprint(b)),guardado);
});

test("idempotencia: rechaza reutilizar la clave para una solicitud distinta", () => {
 const original=fingerprint({accion:"CONSULTAR",evaluacion:{autorizada:false},actorId:"TEST"});
 const distinta=fingerprint({accion:"SIMULAR",evaluacion:{autorizada:false},actorId:"TEST"});
 assert.notEqual(original,distinta);
 assert.throws(()=>resolverExistente({requestFingerprint:original},distinta),{code:"IDEMPOTENCY_KEY_CONFLICT"});
});

test("clasifica como recuperables solo conflictos transaccionales", () => {
 const {esConflictoTransitorio}=require("../../modules/finanzas-personales/services/decisionProofPersistence.service");
 assert.equal(esConflictoTransitorio({code:112}),true);
 assert.equal(esConflictoTransitorio({codeName:"WriteConflict"}),true);
 assert.equal(esConflictoTransitorio({hasErrorLabel:label=>label==="TransientTransactionError"}),true);
 assert.equal(esConflictoTransitorio({code:11000}),false);
 assert.equal(esConflictoTransitorio(new Error("falla permanente")),false);
});

test("idempotencia: fecha de corte explícita distingue solicitudes", () => {
 const base={accion:"CONSULTAR",evaluacion:{autorizada:false},actorId:"TEST"};
 const primera=fingerprint({...base,corte:"2026-10-17T12:00:00.000Z"});
 const segunda=fingerprint({...base,corte:"2026-10-18T12:00:00.000Z"});
 assert.notEqual(primera,segunda);
 assert.equal(primera,fingerprint({...base,corte:new Date("2026-10-17T12:00:00.000Z")}));
 assert.throws(()=>fingerprint({...base,corte:"fecha-invalida"}),TypeError);
});

test("idempotencia: nunca acepta un registro previo sin fingerprint", () => {
 const fp=fingerprint({accion:"CONSULTAR",evaluacion:{autorizada:false}});
 assert.throws(()=>resolverExistente({requestFingerprint:null},fp),{code:"IDEMPOTENCY_FINGERPRINT_MISSING"});
 assert.throws(()=>resolverExistente({},fp),{code:"IDEMPOTENCY_FINGERPRINT_MISSING"});
 assert.equal(resolverExistente(null,fp),null);
});

test("reintento selectivo: solo el índice único de secuencia es recuperable",()=>{
 const {esColisionSecuencia}=require("../../modules/finanzas-personales/services/decisionProofPersistence.service");
 assert.equal(esColisionSecuencia({code:11000,keyPattern:{usuarioId:1,secuencia:1}}),true);
 assert.equal(esColisionSecuencia({code:11000,keyPattern:{usuarioId:1,idempotencyKey:1}}),false);
 assert.equal(esColisionSecuencia({code:11000,keyPattern:{usuarioId:1,hash:1}}),false);
 assert.equal(esColisionSecuencia({code:11000}),false);
 assert.equal(esColisionSecuencia({code:112,keyPattern:{usuarioId:1,secuencia:1}}),false);
});

test("el banco de concurrencia jamás utiliza URI externas ni MongoDB SRV",()=>{
 assert.equal(exigirMongoDePruebasLocal("mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true","SOLO_PRUEBAS_LOCALES"),true);
 assert.throws(()=>exigirMongoDePruebasLocal("mongodb://127.0.0.1:27017",""),/CONFIRMACION_DB_PRUEBAS_REQUERIDA/);
 assert.throws(()=>exigirMongoDePruebasLocal("mongodb://127.0.0.1:27017/?replicaSet=rs0","SOLO_PRUEBAS_LOCALES"),/MONGO_PRUEBAS_NO_LOCAL/);
 assert.throws(()=>exigirMongoDePruebasLocal("mongodb://mongo.empresa.com:27017","SOLO_PRUEBAS_LOCALES"),/MONGO_PRUEBAS_NO_LOCAL/);
 assert.throws(()=>exigirMongoDePruebasLocal("mongodb+srv://cluster.mongodb.net/db","SOLO_PRUEBAS_LOCALES"),/MONGO_PRUEBAS_NO_LOCAL/);
 assert.throws(()=>exigirMongoDePruebasLocal("mongodb://127.0.0.1:27017,servidor:27017","SOLO_PRUEBAS_LOCALES"),/MONGO_PRUEBAS_NO_LOCAL|TEST_MONGO_URI_INVALIDA/);
});
