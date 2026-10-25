"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {crearRegistrador,GENESIS}=require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const uri=process.env.GRUK_V81_TEST_MONGO_URI;
test("compensaciones MongoDB real: estado vigente, concurrencia, rollback e aislamiento",{
 skip:!uri&&process.env.GRUK_REQUIRE_COMPENSACION_MONGO_TEST!=="1"?"Requiere replica set local aislado":false,
 timeout:60000
},async()=>{
 validarMongoPruebasV81(uri);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 const usuarios=Array.from({length:3},()=>new mongoose.Types.ObjectId().toString());
 const movimientoId=new mongoose.Types.ObjectId().toString();
 const original={usuarioId:usuarios[0],movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
 const registrar=crearRegistrador();
 const solicitud=(key,orig=original)=>({original:orig,tipo:"CORRECCION",cambios:{montoMinor:22000},idempotencyKey:key,fechaISO:"2026-10-25T15:00:00.000Z"});
 try{
  await Promise.all([Evento.init(),Cursor.init()]);
  const primero=await registrar(solicitud("correccion"));
  assert.equal(primero.deltaCajaMinor,"3000");
  await assert.rejects(registrar(solicitud("obsoleta")),/desactualizado/);
  const actual={...original,montoMinor:22000};
  const anular=key=>({...solicitud(key,actual),tipo:"ANULACION",cambios:{}});
  const carrera=await Promise.allSettled([registrar(anular("anular_a")),registrar(anular("anular_b"))]);
  assert.equal(carrera.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(carrera.filter(x=>x.status==="rejected").length,1);
  assert.equal(carrera.find(x=>x.status==="fulfilled").value.deltaCajaMinor,"22000");
  await assert.rejects(registrar(anular("tercer_reverso")),/ya anulado/);
  const rows=await Evento.find({usuarioId:usuarios[0]},{_id:0}).sort({secuencia:1}).lean();
  assert.equal(rows.length,2);
  assert.equal(verificarCadena(rows,{prevHash:GENESIS}),true);
  const cursor=await Cursor.findById(usuarios[0]).lean();
  assert.equal(cursor.secuencia,2);
  assert.equal(cursor.hashActual,rows[1].hashActual);
  // La misma identidad de movimiento y clave en otro usuario no reutiliza su historial.
  const otro=await registrar(solicitud("correccion",{...original,usuarioId:usuarios[1]}));
  assert.equal(otro.secuencia,1);
  // Error DESPUÉS del CAS real: la transacción debe revertir el cursor.
  const fallido=crearRegistrador({EventoModelo:{
   collection:Evento.collection,
   findOne:(...args)=>Evento.findOne(...args),find:(...args)=>Evento.find(...args),
   create:async()=>{throw new Error("INSERCION_SIMULADA_FALLIDA");}
  }});
  await assert.rejects(fallido(solicitud("fallo",{...original,usuarioId:usuarios[2]})),/INSERCION_SIMULADA_FALLIDA/);
  assert.equal(await Cursor.findById(usuarios[2]).lean(),null);
  assert.equal(await Evento.countDocuments({usuarioId:usuarios[2]}),0);
 }finally{
  // Los modelos rechazan deletes: limpieza directa SOLO tras validar el destino loopback de pruebas.
  await Evento.collection.deleteMany({usuarioId:{$in:usuarios}});
  await Cursor.collection.deleteMany({_id:{$in:usuarios}});
  await mongoose.disconnect();
 }
});
