"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

// Prueba transaccional destructiva SOLO en base local dedicada y replica set.
// Cada ejecución utiliza usuarios nuevos; nunca toca cuentas reales.
const uri=process.env.TEST_MONGO_URI;
if(process.env.GRUK_REQUIRE_RECURRENT_MONGO_TEST==="1"&&!uri)
 throw new Error("CI recurrente exige TEST_MONGO_URI: no se permite omitir la integración");
const confirmacion=process.env.GRUK_V81_TEST_DB_CONFIRM==="SOLO_PRUEBAS_LOCALES";
if(uri){
 const u=new URL(uri);
 if(u.protocol!=="mongodb:"||!["127.0.0.1","localhost"].includes(u.hostname)||
    u.port!=="27017"||u.pathname!=="/gruk_v81_test"||
    u.host.includes(",")||u.searchParams.has("dbName")||!confirmacion)
  throw new Error("Integración recurrente bloqueada: MongoDB local de pruebas obligatorio");
}
test("MongoDB: pago recurrente vinculado exige propietario y conserva identidad",{
 skip:!uri
},async()=>{
 const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="CLAVE_SOLO_PARA_TEST_LOCAL_NO_PRODUCCION_32_BYTES";
 const mongoose=require("mongoose");
 const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
 const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
 const registrar=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service").registrarTransaccion;
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const propietario=new mongoose.Types.ObjectId();
 const intruso=new mongoose.Types.ObjectId();
 const cuenta="PRUEBA_RECURRENTE_"+propietario.toString();
 const fechaOrigen=new Date(Date.now()-35*86400000);
 const fechaPago=new Date(Date.now()-60000);
 const movimiento=(extra={})=>({
  tipo:"GASTO",montoMinor:200000,moneda:"COP",concepto:"Abono arriendo pruebas",
  categoria:"HOGAR",cuenta,medioPago:"DEBITO",fecha:fechaPago,...extra
 });
 try{
  await Promise.all([Cuenta.init(),Transaccion.init()]);
  await Cuenta.create({usuarioId:propietario,nombre:cuenta,tipo:"OTRA",saldoMinor:900000});
  await Cuenta.create({usuarioId:intruso,nombre:cuenta,tipo:"OTRA",saldoMinor:900000});
  const original=await registrar(propietario,movimiento({
   recurrente:true,frecuencia:"MENSUAL",fecha:fechaOrigen,
   concepto:"Arriendo recurrente"
  }));
  const pago=await registrar(propietario,movimiento({
   recurrente:false,recurrenteOrigenId:original._id,externalId:"abono-rec-001"
  }));
  const persistido=await Transaccion.findOne({_id:pago._id,usuarioId:propietario}).lean();
  assert.equal(String(persistido.recurrenteOrigenId),String(original._id));
  assert.equal(persistido.montoMinor,200000);
  const cuentaPropietario=await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean();
  assert.equal(cuentaPropietario.saldoMinor,500000);
  // Doble clic/reintento: la misma clave nunca debe crear otro débito.
  await assert.rejects(
   registrar(propietario,movimiento({
    recurrenteOrigenId:original._id,externalId:"abono-rec-001"
   })),e=>e.code===11000
  );
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),2);
  assert.equal((await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean()).saldoMinor,500000);
  await assert.rejects(
   registrar(propietario,movimiento({recurrenteOrigenId:original._id})),
   e=>e.statusCode===400 && /externalId estable/.test(e.message)
  );

  await assert.rejects(
   registrar(intruso,movimiento({recurrenteOrigenId:original._id,externalId:"intruso-001"})),
   e=>e.statusCode===404
  );
  assert.equal(await Transaccion.countDocuments({usuarioId:intruso}),0);
  const saldoIntruso=await Cuenta.findOne({usuarioId:intruso,nombre:cuenta}).lean();
  assert.equal(saldoIntruso.saldoMinor,900000);
  await assert.rejects(
   registrar(propietario,movimiento({
    recurrenteOrigenId:new mongoose.Types.ObjectId(),externalId:"origen-inexistente-001"
   })),
   e=>e.statusCode===404
  );
  await assert.rejects(
   registrar(propietario,movimiento({
    recurrenteOrigenId:original._id,externalId:"futuro-001",fecha:new Date(Date.now()+86400000)
   })),
   e=>e.statusCode===400
  );
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),2);
  assert.equal((await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean()).saldoMinor,500000);
 }finally{
  await mongoose.disconnect();
  if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
 }
});
