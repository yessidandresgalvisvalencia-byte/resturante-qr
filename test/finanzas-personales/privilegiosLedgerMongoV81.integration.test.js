"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const mongoose=require("mongoose"),{MongoClient}=mongoose.mongo;
const {COLECCIONES,auditarPrivilegiosLedgerPersonal:auditar}=require("../../modules/finanzas-personales/security/ledgerPersonalDbPrivileges.service");
const {modelosPersonales,provisionarMongoPersonal}=require("../../modules/finanzas-personales/security/provisionMongoPersonal.service");
const base="gruk_v81_test_privilegios";
function validarDestino(uri,env=process.env.NODE_ENV){
 if(env==="production")throw Error("Prueba de privilegios bloqueada en producción");
 const url=new URL(uri);
 if(url.protocol!=="mongodb:"||url.hostname!=="127.0.0.1"||url.port!=="27018"||url.pathname!=="/"+base||url.username||url.password||url.search||url.hash)
  throw Error("Prueba de privilegios limitada a MongoDB local aislado en puerto 27018");
}
test("la prueba de roles rechaza destinos externos, credenciales y otras bases",()=>{
 assert.doesNotThrow(()=>validarDestino(`mongodb://127.0.0.1:27018/${base}`,"test"));
 for(const uri of ["mongodb://servidor:27018/"+base,"mongodb://127.0.0.1:27018/produccion",`mongodb://u:p@127.0.0.1:27018/${base}`,`mongodb://127.0.0.1:27018/${base}?dbName=otra`])assert.throws(()=>validarDestino(uri,"test"));
 assert.throws(()=>validarDestino(`mongodb://127.0.0.1:27018/${base}`,"production"));
});
const uri=process.env.GRUK_V81_TEST_MONGO_AUTH_URI;
async function probarMigracionAutorizada(db,uri,password,t){
 validarDestino(uri);
 const Legacy=require("../../modules/finanzas-personales/models/movimiento.model");
 const Tx=require("../../modules/finanzas-personales/models/TransaccionPersonal");
 const Reporte=require("../../modules/finanzas-personales/models/migracionPersonal.model");
 const migracion=require("../../modules/finanzas-personales/services/migracionLedgerPersonal.service");
 const anterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;process.env.PERSONAL_IDEMPOTENCY_SECRET=crypto.randomBytes(32).toString("hex");
 const uid=()=>new mongoose.Types.ObjectId();
 const datos=(userId,tipo,monto)=>({userId,tipo,monto,concepto:"Dato histórico",categoria:"Prueba",fecha:new Date(Date.now()-60000)});
 try{
  await mongoose.connect(uri,{auth:{username:"writer",password},authSource:base,autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:7000});
  const a=uid(),b=uid();
  const fuentes=await Legacy.create([datos(a,"INGRESO",1000),datos(a,"GASTO",250),datos(b,"INGRESO",700)]);
  const antesLegacy=await Legacy.find({userId:a}).sort({_id:1}).lean();
  const primero=await migracion.migrar(a);assert.equal(primero.estado,"RECONCILIADA");assert.equal(primero.ledgerCount,2);
  const antesTx=await Tx.find({usuarioId:a}).sort({_id:1}).lean();
  assert.equal(antesTx.length,2);assert.equal(await Tx.countDocuments({usuarioId:b}),0);
  assert.equal((await migracion.migrar(a)).estado,"RECONCILIADA");
  assert.deepEqual(await Tx.find({usuarioId:a}).sort({_id:1}).lean(),antesTx);
  assert.deepEqual(await Legacy.find({userId:a}).sort({_id:1}).lean(),antesLegacy);
  // Totales compensados no deben ocultar cambios en dos fuentes distintas.
  await Legacy.updateOne({_id:fuentes[0]._id},{$set:{monto:1010}});await Legacy.updateOne({_id:fuentes[1]._id},{$set:{monto:260}});
  const alterado=await migracion.reconciliar(a);assert.equal(alterado.diferenciaMinor,0);assert.equal(alterado.estado,"ERROR");
  await assert.rejects(migracion.migrar(a),e=>e.statusCode===409);
  assert.deepEqual(await Tx.find({usuarioId:a}).sort({_id:1}).lean(),antesTx);
  for(const monto of [0,1.5,Number.MAX_SAFE_INTEGER+1]){
   const user=uid();await Legacy.create(datos(user,"GASTO",monto));
   await assert.rejects(migracion.migrar(user),e=>e.statusCode===422);assert.equal(await Tx.countDocuments({usuarioId:user}),0);
  }
  const carrera=uid();await Legacy.create([datos(carrera,"INGRESO",100),datos(carrera,"GASTO",30)]);
  const intentos=await Promise.allSettled([migracion.migrar(carrera),migracion.migrar(carrera)]);
  assert.ok(intentos.some(x=>x.status==="fulfilled"));
  assert.equal((await migracion.migrar(carrera)).ledgerCount,2);assert.equal(await Tx.countDocuments({usuarioId:carrera}),2);
  const rollback=uid();await Legacy.create(datos(rollback,"INGRESO",10));
  const guardar=Reporte.findOneAndUpdate;Reporte.findOneAndUpdate=()=>Promise.reject(Error("Fallo simulado del reporte"));
  try{await assert.rejects(migracion.migrar(rollback),/Fallo simulado/);}finally{Reporte.findOneAndUpdate=guardar;}
  assert.equal(await Tx.countDocuments({usuarioId:rollback}),0);assert.equal(await Reporte.countDocuments({usuarioId:rollback}),0);
  await db.collection("fin_transacciones_personales").dropIndex("usuarioId_1_externalIdHash_1");
  await assert.rejects(migracion.migrar(b),e=>e.statusCode===503);assert.equal(await Tx.countDocuments({usuarioId:b}),0);
  await provisionarMongoPersonal(db);assert.equal((await migracion.migrar(b)).ledgerCount,1);
  const {probarCajaAutorizada,probarCadenaV81Autorizada,probarIndicesEnCaliente,probarCadenaCompensatoriaAlterada}=require("./helpers/operacionesLedgerAutorizadas");
  await t.test("caja, compensaciones, reintentos y rollback con rol restringido",probarCajaAutorizada);
  await t.test("cadena V81 y anulación con rol restringido",probarCadenaV81Autorizada);
  await t.test("índices cambiados en caliente bloquean escrituras sin alterar caja ni historial",()=>probarIndicesEnCaliente(db));
  await t.test("cadena compensatoria incompleta o alterada bloquea escrituras en otros movimientos",()=>probarCadenaCompensatoriaAlterada(db));
  await t.test("aprobación conversacional vincula la cuenta y conserva atomicidad con rol restringido",
   require("./helpers/aprobacionConversacionalAutorizada").probarAprobacionConversacionalAutorizada);
  await t.test("cobros conversacionales conservan préstamo, caja y clasificación con rol restringido",
   require("./helpers/cobrosConversacionalesAutorizados").probarCobrosConversacionalesAutorizados);
  await t.test("transferencias conversacionales conservan dinero y bloquean conciliaciones anteriores",
   require("./helpers/transferenciasConversacionalesAutorizadas").probarTransferenciasConversacionalesAutorizadas);
  await t.test("ajustes conversacionales respetan movimientos posteriores y revierten lotes fallidos",
   require("./helpers/saldosConversacionalesAutorizados").probarSaldosConversacionalesAutorizados);
  await t.test("progreso económico usa compensaciones y respeta acciones aprobadas",
   require("./helpers/progresoEconomicoAutorizado").probarProgresoEconomicoAutorizado);
  await t.test("panel conserva compromisos recurrentes más allá de los cien registros recientes",
   require("./helpers/lecturasHomeAutorizadas").probarLecturasHomeAutorizadas);
  await t.test("completar acciones exige evidencia vigente y revierte fallos de auditoría",
   require("./helpers/evidenciaProgresoAutorizada").probarEvidenciaProgresoAutorizada);
  await t.test("deudas conversacionales validan saldos sin inventar activos y revierten fallos",
   require("./helpers/deudasConversacionalesAutorizadas").probarDeudasConversacionalesAutorizadas);
  await t.test("auditoría de anclas compensatorias es de solo lectura y detecta truncamientos",
   ()=>require("./helpers/anclaCompensacionesAutorizada").probarAnclaCompensacionesAutorizada(db));
 }finally{
  await mongoose.disconnect();if(anterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;else process.env.PERSONAL_IDEMPOTENCY_SECRET=anterior;
 }
}
test("MongoDB con autorización: rol insert-only bloquea modificación y borrado reales",{
 skip:!uri&&process.env.GRUK_REQUIRE_PRIVILEGIOS_MONGO_TEST!=="1"?"Requiere MongoDB local con --auth":false,timeout:60000
},async t=>{
 validarDestino(uri);
 // Credenciales exclusivas del contenedor efímero de CI, nunca del despliegue.
 const root=new MongoClient(uri,{auth:{username:"gruk_test_root",password:"gruk_test_root_local_only"},authSource:"admin",serverSelectionTimeoutMS:7000});
 const clientes=[];const creados=[];
 const mutables=["fin_outbox_personal","fin_cursor_compensaciones_personales_v1","fin_cuentas_personales"];
 const password=crypto.randomBytes(24).toString("hex");
 const client=async username=>{
  const c=new MongoClient(uri,{auth:{username,password},authSource:base,serverSelectionTimeoutMS:7000});clientes.push(c);await c.connect();return c;
 };
 try{
  await root.connect();const db=root.db(base);
  const provision=await provisionarMongoPersonal(db);
  assert.ok(provision.modelos>=44);assert.equal((await provisionarMongoPersonal(db)).coleccionesCreadas,0);
  const adminCli=spawnSync(process.execPath,[path.resolve(__dirname,"../../scripts/provision-personal-mongo.js"),"--apply"],{
   env:{...process.env,PERSONAL_MONGO_PROVISION_URI:`mongodb://gruk_test_root:gruk_test_root_local_only@127.0.0.1:27018/${base}?authSource=admin`,PERSONAL_MONGO_DB:base},
   encoding:"utf8",timeout:20000
  });
  assert.equal(adminCli.status,0,adminCli.stderr);assert.equal(JSON.parse(adminCli.stdout).coleccionesCreadas,0);
  const proyecciones=modelosPersonales().map(m=>m.collection.collectionName).filter(c=>!COLECCIONES.includes(c));
  await db.command({createRole:"ledger_writer",privileges:[
   ...COLECCIONES.map(collection=>({resource:{db:base,collection},actions:["find","insert","listIndexes"]})),
   ...proyecciones.map(collection=>({resource:{db:base,collection},actions:["find","insert","update","remove","listIndexes"]}))
  ],roles:[]});
  for(const [user,roles] of [["writer",[{role:"ledger_writer",db:base}]],["unsafe",[{role:"readWrite",db:base}]],["reader",[{role:"read",db:base}]]]){
   await db.command({createUser:user,pwd:password,roles});creados.push(user);
  }
  const writer=(await client("writer")).db(base);
  const informe=await auditar(writer);
  assert.equal(informe.compatible,true);assert.equal(informe.certificaInmutabilidad,false);
  for(const nombre of COLECCIONES){
   const col=writer.collection(nombre);
   await col.insertOne({_id:"prueba",valor:1});assert.equal((await col.findOne({_id:"prueba"})).valor,1);
   for(const operacion of [()=>col.updateOne({_id:"prueba"},{$set:{valor:2}}),()=>col.deleteOne({_id:"prueba"}),
    ()=>col.replaceOne({_id:"prueba"},{valor:3}),()=>col.drop(),()=>col.createIndex({valor:1})])
    await assert.rejects(operacion(),e=>e.code===13);
   assert.equal((await col.findOne({_id:"prueba"})).valor,1);
  }
  for(const nombre of mutables){
   await writer.collection(nombre).insertOne({_id:"control",revision:0});
   await writer.collection(nombre).updateOne({_id:"control"},{$inc:{revision:1}});
   assert.equal((await writer.collection(nombre).findOne({_id:"control"})).revision,1);
  }
  assert.equal((await auditar((await client("unsafe")).db(base))).compatible,false);
  const reader=await auditar((await client("reader")).db(base));
  assert.equal(reader.compatible,false);assert.ok(reader.colecciones.every(c=>c.faltantes.includes("insert")));
  assert.equal((await auditar(db)).compatible,false);
  const anonimo=new MongoClient(uri,{serverSelectionTimeoutMS:7000});clientes.push(anonimo);await anonimo.connect();
  assert.equal((await auditar(anonimo.db(base))).compatible,false);
  await assert.rejects(anonimo.db(base).collection(COLECCIONES[0]).insertOne({_id:"sin_auth"}),e=>e.code===13);

  // Ejecutar el CLI real demuestra que la auditoría no necesita permisos de DDL.
  const nombresAntes=(await db.listCollections({},{nameOnly:true}).toArray()).map(c=>c.name).sort();
  const child=spawnSync(process.execPath,[path.resolve(__dirname,"../../scripts/audit-personal-mongo-privileges.js")],{
   env:{...process.env,PERSONAL_MONGO_URI:`mongodb://writer:${password}@127.0.0.1:27018/${base}?authSource=${base}`,PERSONAL_MONGO_DB:base},encoding:"utf8",timeout:15000
  });
  assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).compatible,true);
  assert.doesNotMatch(child.stdout+child.stderr,new RegExp(password));
  assert.doesNotMatch(child.stdout,/ledger_writer|authenticatedUsers|mongodb:\/\//);
  assert.deepEqual((await db.listCollections({},{nameOnly:true}).toArray()).map(c=>c.name).sort(),nombresAntes);
  function arranque(usuario){
   const programa=`
    const mongoose=require('mongoose'),net=require('node:net');
    require('./modules/finanzas-personales/services/macroCollector.service').persistColombia=async()=>{};
    require('./modules/finanzas-personales/services/recordatoriosCobro.service').ejecutar=async()=>{};
    require('./modules/finanzas-personales/services/flujoCajaPersonal.service').republicarPendientes=async()=>{};
    (async()=>{
     const reserva=net.createServer();await new Promise(r=>reserva.listen(0,'127.0.0.1',r));
     process.env.PORT=String(reserva.address().port);await new Promise(r=>reserva.close(r));
     try{
      const runtime=await require('./modules/finanzas-personales/server').start();
      const health=await fetch('http://127.0.0.1:'+process.env.PORT+'/healthz');
      const resultado={status:health.status,autoCreate:mongoose.connection.config.autoCreate,autoIndex:mongoose.connection.config.autoIndex};
      await new Promise(r=>runtime.io.close(r));await mongoose.disconnect();
      console.log('RESULTADO_ARRANQUE '+JSON.stringify(resultado));process.exit(0);
     }catch(e){
      const codigo=['PRIVILEGIOS_FINANCIEROS_NO_VERIFICADOS','INDICES_FINANCIEROS_NO_VERIFICADOS'].includes(e.message)?e.message:'ERROR_NO_ESPERADO';
      console.log('RESULTADO_ARRANQUE '+JSON.stringify({codigo,conexion:mongoose.connection.readyState}));process.exit(0);
     }
    })();`;
   const env={...process.env,PERSONAL_MONGO_URI:`mongodb://${usuario}:${password}@127.0.0.1:27018/${base}?authSource=${base}`,PERSONAL_MONGO_DB:base,
    PERSONAL_DATA_KEY:crypto.randomBytes(32).toString("base64")};
   for(const key of ["PERSONAL_MARKET_INGEST_SECRET","PERSONAL_JWT_SECRET","PERSONAL_RESET_SECRET","PERSONAL_IDEMPOTENCY_SECRET","PERSONAL_ENTITLEMENT_SYNC_SECRET"])env[key]="secreto-local-de-prueba-no-produccion";
   const child=spawnSync(process.execPath,["-e",programa],{cwd:path.resolve(__dirname,"../.."),env,encoding:"utf8",timeout:15000});
   assert.equal(child.status,0,child.stderr);assert.doesNotMatch(child.stdout+child.stderr,new RegExp(password));
   const linea=child.stdout.split("\n").find(l=>l.startsWith("RESULTADO_ARRANQUE "));assert.ok(linea,child.stdout);
   return JSON.parse(linea.slice("RESULTADO_ARRANQUE ".length));
  }
  assert.deepEqual(arranque("writer"),{status:200,autoCreate:false,autoIndex:false});
  assert.deepEqual(arranque("unsafe"),{codigo:"PRIVILEGIOS_FINANCIEROS_NO_VERIFICADOS",conexion:0});
  await db.collection("fin_eventos_compensatorios_personales_v1").dropIndex("fp_compensacion_orden_usuario_v1");
  assert.deepEqual(arranque("writer"),{codigo:"INDICES_FINANCIEROS_NO_VERIFICADOS",conexion:0});
  await provisionarMongoPersonal(db);
  // El índice existe y es único, pero su filtro deja fuera parte del historial.
  const transacciones=db.collection("fin_transacciones_personales");
  await transacciones.dropIndex("usuarioId_1_externalIdHash_1");
  await transacciones.createIndex({usuarioId:1,externalIdHash:1},{unique:true,
   partialFilterExpression:{externalIdHash:{$type:"string"},estado:"ACTIVA"}});
  assert.deepEqual(arranque("writer"),{codigo:"INDICES_FINANCIEROS_NO_VERIFICADOS",conexion:0});
  await transacciones.dropIndex("usuarioId_1_externalIdHash_1");
  await provisionarMongoPersonal(db);
  const reservas=db.collection("fin_reservas_cuotas_recurrentes");
  const claveReserva={usuarioId:1,origenId:1,periodoInicio:1};
  await reservas.dropIndex("usuarioId_1_origenId_1_periodoInicio_1");
  await reservas.createIndex(claveReserva,{unique:true,sparse:true});
  assert.deepEqual(arranque("writer"),{codigo:"INDICES_FINANCIEROS_NO_VERIFICADOS",conexion:0});
  await reservas.dropIndex("usuarioId_1_origenId_1_periodoInicio_1");
  await provisionarMongoPersonal(db);
  assert.deepEqual(arranque("writer"),{status:200,autoCreate:false,autoIndex:false});
  assert.deepEqual((await db.listCollections({},{nameOnly:true}).toArray()).map(c=>c.name).sort(),nombresAntes);
  await probarMigracionAutorizada(db,uri,password,t);
 }finally{
  await Promise.all(clientes.map(c=>c.close()));
  for(const user of creados)await root.db(base).command({dropUser:user});
  if(creados.length)await root.db(base).command({dropRole:"ledger_writer"});
  await root.db(base).dropDatabase();await root.close();
 }
});
