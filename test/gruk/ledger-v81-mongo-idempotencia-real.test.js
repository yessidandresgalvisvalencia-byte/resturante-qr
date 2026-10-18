"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Evento=require("../../modules/finanzas-personales/models/eventoV81.model");
const Cabeza=require("../../modules/finanzas-personales/models/cabezaV81.model");
const {anexarEventoV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");

const uri=process.env.GRUK_V81_TEST_MONGO_URI;
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
let seguro=false;
try{seguro=validarMongoPruebasV81(uri);}catch(_){seguro=false;}
const base={id:"v81_reintento_igual",tipo:"GASTO",montoCentavos:2500030n,fechaContable:"2026-01-01",timestamp:"2026-01-01T10:00:00-05:00"};

test("MongoDB real: reintento concurrente idempotente e aislamiento entre usuarios",{
 skip:seguro?false:"Requiere MongoDB replica set local (loopback), base gruk_v81_test_*, sin credenciales, NODE_ENV no productivo",
 timeout:60000
},async()=>{
 const a=new mongoose.Types.ObjectId(),b=new mongoose.Types.ObjectId(),c=new mongoose.Types.ObjectId(),d=new mongoose.Types.ObjectId();
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 try{
  // El índice compuesto es una condición de la garantía, no una suposición.
  await Promise.all([Evento.init(),Cabeza.init()]);
  const solicitudes=await Promise.allSettled([
   anexarEventoV81(a,base),
   anexarEventoV81(a,base)
  ]);
  assert.equal(solicitudes.filter(x=>x.status==="fulfilled").length>=1,true);
  for(const resultado of solicitudes){
   if(resultado.status==="rejected")assert.equal(resultado.reason.statusCode===409 || [112,251].includes(resultado.reason.code) || resultado.reason.hasErrorLabel?.("TransientTransactionError")===true,true);
  }
  assert.equal(await Evento.countDocuments({usuarioId:a,eventId:base.id}),1);
  const primero=await Evento.findOne({usuarioId:a,eventId:base.id}).lean();
  const cabeza=await Cabeza.findOne({usuarioId:a}).lean();
  assert.equal(cabeza.version,1);
  assert.equal(cabeza.hashActual,primero.hashActual);

  // El reintento secuencial devuelve exactamente el evento existente.
  const reintento=await anexarEventoV81(a,base);
  assert.equal(reintento.hashActual,primero.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);
  await assert.rejects(
   ()=>anexarEventoV81(a,{...base,montoCentavos:2500130n}),
   error=>error.statusCode===409
  );
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);

  // El mismo eventId de otro usuario no debe colisionar ni consultar el primero.
  const otro=await anexarEventoV81(b,base);
  assert.equal(otro.version,1);
  assert.notEqual(otro.hashActual,primero.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId:b}),1);
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);

  const rows=await Evento.find({usuarioId:a}).sort({version:1}).lean();
  assert.equal(verificarCadena(rows.map(e=>({
   id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
   montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
   timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
   tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
  })),cabeza.hashActual),true);

  // Dos IDs distintos compiten por la misma cabeza; ambos deben poder recuperarse
  // mediante el ID original sin perder un evento ni repetirlo.
  const entradas=[
   {...base,id:"v81_concurrente_uno"},
   {...base,id:"v81_concurrente_dos",montoCentavos:9900n}
  ];
  const carrera=await Promise.allSettled(entradas.map(datos=>anexarEventoV81(d,datos)));
  assert.ok(carrera.some(r=>r.status==="fulfilled"));
  for(const resultado of carrera){
   if(resultado.status==="rejected"){
    assert.equal(resultado.reason.statusCode,409);
    assert.equal(resultado.reason.codigo,"REINTENTAR_MISMO_ID");
   }
  }
  // El resultado de la carrera no implica que un fallo sea definitivo:
  // repetir con la misma clave resuelve tanto escrituras confirmadas como abortadas.
  for(const datos of entradas){
   const resuelto=await anexarEventoV81(d,datos);
   assert.equal(resuelto.id,datos.id);
  }
  const eventosD=await Evento.find({usuarioId:d}).sort({version:1}).lean();
  const cabezaD=await Cabeza.findOne({usuarioId:d}).lean();
  assert.equal(eventosD.length,2);
  assert.equal(cabezaD.version,2);
  assert.equal(new Set(eventosD.map(e=>e.eventId)).size,2);
  assert.equal(eventosD.reduce((s,e)=>s+BigInt(e.montoCentavos),0n),2509930n);
  // Un replay del primer evento despues del segundo no debe recalcularlo
  // usando la cabeza actual, ni crear version 3, ni cambiar su hash original.
  const hashInicial=eventosD.find(e=>e.eventId===entradas[0].id).hashActual;
  const versionInicial=eventosD.find(e=>e.eventId===entradas[0].id).version;
  const replayTrasOtro=await anexarEventoV81(d,entradas[0]);
  assert.equal(replayTrasOtro.hashActual,hashInicial);
  assert.equal(replayTrasOtro.version,versionInicial);
  assert.equal(await Evento.countDocuments({usuarioId:d}),2);
  assert.equal((await Cabeza.findOne({usuarioId:d}).lean()).hashActual,cabezaD.hashActual);
  await assert.rejects(
   ()=>anexarEventoV81(d,{...entradas[0],montoCentavos:2500031n}),
   error=>error.statusCode===409 && error.codigo!=="REINTENTAR_MISMO_ID"
  );
  assert.equal(await Evento.countDocuments({usuarioId:d}),2);
  assert.equal((await Cabeza.findOne({usuarioId:d}).lean()).hashActual,cabezaD.hashActual);

  assert.equal(verificarCadena(eventosD.map(e=>({
   id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
   montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
   timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
   tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
  })),cabezaD.hashActual),true);

  // Simulación exclusivamente local de manipulación directa, fuera de Mongoose.
  // Un atacante que altere un monto almacenado no debe poder anexar otro evento.
  await Evento.collection.updateOne({_id:primero._id},{$set:{montoCentavos:"2500031"}});
  await assert.rejects(
   ()=>anexarEventoV81(a,{...base,id:"v81_despues_de_tamper"}),
   error=>error.statusCode===409 && /integridad/i.test(error.message)
  );
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);
  assert.equal((await Cabeza.findOne({usuarioId:a}).lean()).hashActual,cabeza.hashActual);

  // Borrado simulado del segundo de tres eventos. La cabeza conserva el hash final.
  for(const [i,id] of ["v81_primero","v81_intermedio","v81_tercero"].entries()){
   const agregado=await anexarEventoV81(c,{...base,id});
   assert.equal(agregado.version,i+1);
  }
  const cabezaAntes=await Cabeza.findOne({usuarioId:c}).lean();
  const terceroAntes=await Evento.findOne({usuarioId:c,version:3}).lean();
  assert.equal(cabezaAntes.hashActual,terceroAntes.hashActual);
  const borrado=await Evento.collection.deleteOne({usuarioId:c,version:2});
  assert.equal(borrado.deletedCount,1);
  assert.equal(await Evento.countDocuments({usuarioId:c}),2);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).hashActual,cabezaAntes.hashActual);
  await assert.rejects(
   ()=>anexarEventoV81(c,{...base,id:"v81_despues_de_borrado"}),
   error=>error.statusCode===409 && /integridad/i.test(error.message)
  );
  assert.equal(await Evento.countDocuments({usuarioId:c}),2);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).version,3);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).hashActual,cabezaAntes.hashActual);
 }finally{
  // Limpieza exclusiva de los cuatro ObjectIds generados para esta prueba.
  await Evento.collection.deleteMany({usuarioId:{$in:[a,b,c,d]}});
  await Cabeza.collection.deleteMany({usuarioId:{$in:[a,b,c,d]}});
  await mongoose.disconnect();
 }
});
