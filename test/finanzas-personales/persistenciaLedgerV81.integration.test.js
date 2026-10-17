"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
// Solo se permite ejecutar esta prueba destructiva contra un MongoDB local aislado.
// La prueba elimina únicamente eventos del usuario temporal que crea.
const uri=process.env.TEST_MONGO_URI;
const habilitada=process.env.GRUK_V81_TEST_DB_CONFIRM==="SOLO_PRUEBAS_LOCALES";
const configurada=Boolean(uri);
if(configurada) {
 const parsed=new URL(uri);
 const host=parsed.hostname.toLowerCase();
 const db=decodeURIComponent(parsed.pathname.slice(1));
 if(parsed.protocol!=="mongodb:" || !["localhost","127.0.0.1","::1","[::1]"].includes(host) ||
    db!=="gruk_v81_test" || parsed.searchParams.has("dbName") || !habilitada) {
  throw new Error("Prueba V81 bloqueada: usa mongodb://127.0.0.1:27017/gruk_v81_test y habilitación explícita");
 }
}
// Sin TEST_MONGO_URI: Node registra el test como omitido sin cargar mongoose.
// Con TEST_MONGO_URI: requiere dependencias y replica set disponibles.
let mongoose,anexarEventoV81,verificarLedgerPersistidoV81,Evento,Cabeza;
if(configurada){
 mongoose=require("mongoose");
 ({anexarEventoV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service"));
 ({verificarLedgerPersistidoV81}=require("../../modules/finanzas-personales/services/verificacionLedgerV81.service"));
 Evento=require("../../modules/finanzas-personales/models/eventoV81.model");
 Cabeza=require("../../modules/finanzas-personales/models/cabezaV81.model");
}
const datos=(id)=>({
 id,tipo:"GASTO",montoCentavos:2500000n,
 fechaContable:"2026-10-17",timestamp:"2026-10-17T14:00:00-05:00"
});
test("integración MongoDB V81: reintentos, concurrencia e integridad", {skip:!configurada},async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const usuarioId=new mongoose.Types.ObjectId();
 try{
  await Promise.all([Evento.init(),Cabeza.init()]);
  const indices=await Evento.collection.indexes();
  assert.ok(indices.some(i=>i.unique===true && i.partialFilterExpression?.tipo==="ANULACION" &&
    i.key?.usuarioId===1 && i.key?.corrigeId===1 && i.key?.tipo===1),
    "Debe existir índice único por anulación para proteger escrituras concurrentes");
  const original=await anexarEventoV81(usuarioId,datos("registro-uno"));
  const repetido=await anexarEventoV81(usuarioId,datos("registro-uno"));
  assert.equal(original.hashActual,repetido.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId}),1);
  await assert.rejects(
   anexarEventoV81(usuarioId,{...datos("registro-uno"),montoCentavos:3000000n}),
   e=>e.statusCode===409
  );
  const intentos=await Promise.allSettled([
   anexarEventoV81(usuarioId,datos("registro-dos")),
   anexarEventoV81(usuarioId,datos("registro-tres"))
  ]);
  assert.ok(intentos.some(x=>x.status==="fulfilled"));
  for(const x of intentos) if(x.status==="rejected") assert.ok(
   x.reason?.statusCode===409 || x.reason?.hasErrorLabel?.("TransientTransactionError"),
   "Solo se permiten conflictos transitorios de concurrencia"
  );
  // Una corrección de importe cero debe rechazarse sin añadir eventos.
  const antesCorreccion=await Evento.countDocuments({usuarioId});
  await assert.rejects(
   anexarEventoV81(usuarioId,{...datos("correccion-cero"),tipo:"CORRECCION",
    montoCentavos:0n,corrigeId:"registro-uno",tipoCorregido:"GASTO",motivo:"Corrección inválida"}),
   e=>e.statusCode===400 && /monto positivo/.test(e.message)
  );
  assert.equal(await Evento.countDocuments({usuarioId}),antesCorreccion);
  // Dos anulaciones simultáneas sobre el mismo gasto no pueden aplicarse dos veces.
  const cancelaciones=await Promise.allSettled([
   anexarEventoV81(usuarioId,{...datos("anulacion-uno"),tipo:"ANULACION",montoCentavos:0n,corrigeId:"registro-uno",motivo:"Movimiento duplicado"}),
   anexarEventoV81(usuarioId,{...datos("anulacion-dos"),tipo:"ANULACION",montoCentavos:0n,corrigeId:"registro-uno",motivo:"Movimiento duplicado"})
  ]);
  assert.equal(cancelaciones.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(await Evento.countDocuments({usuarioId,corrigeId:"registro-uno",tipo:"ANULACION"}),1);
  const auditoria=await verificarLedgerPersistidoV81(usuarioId);
  assert.equal(auditoria.integridad,"VERIFICADA");
  const cabeza=await Cabeza.findOne({usuarioId}).lean();
  assert.equal(auditoria.cantidad,cabeza.version);
  assert.equal(auditoria.cantidad,await Evento.countDocuments({usuarioId}));
  // Simular truncamiento malicioso en la base aislada: la siguiente escritura debe bloquearse.
  const ultimo=await Evento.findOne({usuarioId}).sort({version:-1}).lean();
  await Evento.collection.deleteOne({_id:ultimo._id});
  assert.equal((await verificarLedgerPersistidoV81(usuarioId)).integridad,"FALLIDA");
  await assert.rejects(anexarEventoV81(usuarioId,datos("tras-truncamiento")),
   e=>e.statusCode===409 && /Integridad V81 comprometida/.test(e.message));
  // Restaurar el último y borrar un evento intermedio; la cabeza aún coincide.
  await Evento.collection.insertOne(ultimo);
  const primero=await Evento.findOne({usuarioId,version:1}).lean();
  // Adulterar el primer evento ya existente conservando el último hash.
  await Evento.collection.updateOne({_id:primero._id},{$set:{montoCentavos:"9999999"}});
  assert.equal((await verificarLedgerPersistidoV81(usuarioId)).integridad,"FALLIDA");
  await assert.rejects(anexarEventoV81(usuarioId,datos("registro-uno")),
   e=>e.statusCode===409 && /cadena criptográfica inválida/.test(e.message),
   "Un reintento idéntico no debe ocultar una adulteración del historial");
  await assert.rejects(anexarEventoV81(usuarioId,datos("tras-adulteracion")),
   e=>e.statusCode===409 && /cadena criptográfica inválida/.test(e.message));
  await Evento.collection.deleteOne({_id:primero._id});
  assert.equal((await verificarLedgerPersistidoV81(usuarioId)).integridad,"FALLIDA");
  await assert.rejects(anexarEventoV81(usuarioId,datos("tras-hueco-intermedio")),
   e=>e.statusCode===409 && /cantidad de eventos/.test(e.message));


 }finally{
  // Borrar exclusivamente registros de prueba con usuarioId aleatorio en BD de test.
  await Evento.collection.deleteMany({usuarioId});
  await Cabeza.collection.deleteMany({usuarioId});
  await mongoose.disconnect();
 }
});
