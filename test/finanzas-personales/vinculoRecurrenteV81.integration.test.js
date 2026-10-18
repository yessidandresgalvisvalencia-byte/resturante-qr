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
 const ReservaCuota=require("../../modules/finanzas-personales/models/reservaCuotaRecurrente.model");
 const {registrarTransaccion:registrar,anularTransaccion:anular,corregirTransaccion:corregir}=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
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
  await Promise.all([Cuenta.init(),Transaccion.init(),ReservaCuota.init()]);
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
  // El asiento original de hoy ya descontó caja; rechazar pago ligado al
  // mismo asiento en la fecha civil, incluso si utiliza otra clave.
  const fechaHoy=new Date(Date.now()-10000);
  const origenHoy=await registrar(propietario,movimiento({
   recurrente:true,frecuencia:"DIARIA",fecha:fechaHoy,
   montoMinor:50000,concepto:"Gasto recurrente registrado hoy"
  }));
  await assert.rejects(
   registrar(propietario,movimiento({
    recurrenteOrigenId:origenHoy._id,externalId:"doble-origen-hoy-001",
    fecha:fechaHoy,montoMinor:50000
   })),
   e=>e.statusCode===409 && /ya afecta caja/.test(e.message)
  );
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),3);
  assert.equal((await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean()).saldoMinor,450000);
  const otroOrigen=await registrar(propietario,movimiento({
   recurrente:true,frecuencia:"MENSUAL",fecha:fechaOrigen,
   concepto:"Servicio recurrente",montoMinor:150000
  }));
  for(const [externalId,montoMinor] of [["abono-uno",80000],["abono-dos",70000]]){
   await registrar(propietario,movimiento({
    recurrenteOrigenId:otroOrigen._id,externalId,montoMinor
   }));
  }
  await assert.rejects(registrar(propietario,movimiento({
   recurrenteOrigenId:otroOrigen._id,externalId:"abono-sobrepasado",montoMinor:1
  })),e=>e.statusCode===409&&/supera el saldo/.test(e.message));
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),6);
  assert.equal((await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean()).saldoMinor,150000);
  // Dos días distintos del mismo período mensual comparten presupuesto.
  const origenPeriodo=await registrar(propietario,movimiento({
   recurrente:true,frecuencia:"MENSUAL",fecha:new Date("2024-01-01T05:00:00Z"),
   concepto:"Recurrencia con abonos cruzados",montoMinor:30000
  }));
  const pasado=new Date();
  pasado.setUTCDate(1);
  pasado.setUTCMonth(pasado.getUTCMonth()-1);
  pasado.setUTCHours(16,0,0,0);
  const diaDos=new Date(pasado.getTime()+86400000);
  await registrar(propietario,movimiento({
   recurrenteOrigenId:origenPeriodo._id,externalId:"mes-abono-dia1",
   fecha:pasado,montoMinor:10000
  }));
  await registrar(propietario,movimiento({
   recurrenteOrigenId:origenPeriodo._id,externalId:"mes-abono-dia2",
   fecha:diaDos,montoMinor:20000
  }));
  await assert.rejects(registrar(propietario,movimiento({
   recurrenteOrigenId:origenPeriodo._id,externalId:"mes-sobrepago-dia3",
   fecha:new Date(diaDos.getTime()+86400000),montoMinor:1
  })),e=>e.statusCode===409&&/supera el saldo/.test(e.message));
  // El asiento inicial ya afectó caja: ni con otra fecha del primer ciclo.
  await assert.rejects(registrar(propietario,movimiento({
   recurrenteOrigenId:origenPeriodo._id,externalId:"primer-ciclo-duplicado",
   fecha:new Date("2024-01-02T10:00:00Z"),montoMinor:1
  })),e=>e.statusCode===409);
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),9);
  assert.equal((await Cuenta.findOne({usuarioId:propietario,nombre:cuenta}).lean()).saldoMinor,90000);
  // Dos conexiones lógicas (cuentas diferentes) compiten por el mismo
  // cupo, con claves distintas. Solo una puede reservar los 40.000.
  const otraCuenta=cuenta+"_OTRA";
  await Cuenta.create({usuarioId:propietario,nombre:otraCuenta,tipo:"OTRA",saldoMinor:100000});
  const origenConcurrente=await registrar(propietario,movimiento({
   recurrente:true,frecuencia:"MENSUAL",fecha:fechaOrigen,
   montoMinor:50000,concepto:"Cuota concurrente"
  }));
  const intentos=await Promise.allSettled([
   registrar(propietario,movimiento({
    recurrenteOrigenId:origenConcurrente._id,
    externalId:"competencia-uno",montoMinor:40000,cuenta
   })),
   registrar(propietario,movimiento({
    recurrenteOrigenId:origenConcurrente._id,
    externalId:"competencia-dos",montoMinor:40000,cuenta:otraCuenta
   }))
  ]);
  assert.equal(intentos.filter(x=>x.status==="fulfilled").length,1,
   "Dos pagos simultáneos no pueden consumir la misma cuota");
  assert.equal(intentos.filter(x=>x.status==="rejected").length,1);
  assert.equal(await Transaccion.countDocuments({
   usuarioId:propietario,recurrenteOrigenId:origenConcurrente._id
  }),1);
  const saldos=await Cuenta.find({usuarioId:propietario,nombre:{$in:[cuenta,otraCuenta]}}).lean();
  assert.equal(saldos.reduce((n,x)=>n+x.saldoMinor,0),100000);
  const reservas=await ReservaCuota.find({usuarioId:propietario,origenId:origenConcurrente._id}).lean();
  assert.equal(reservas.length,1);
  assert.equal(reservas[0].reservadoMinor,40000);

  // Corregir el importe o tipo no puede desincronizar la reserva atómica.
  const abonoActivo=await Transaccion.findOne({
   usuarioId:propietario,recurrenteOrigenId:origenConcurrente._id,estado:"ACTIVA"
  }).lean();
  await assert.rejects(corregir(propietario,abonoActivo._id,{
   montoMinor:39999
  }),e=>e.statusCode===409 && /abono recurrente/.test(e.message));
  await assert.rejects(corregir(propietario,origenConcurrente._id,{
   montoMinor:49999
  }),e=>e.statusCode===409 && /abonos vigentes/.test(e.message));
  await assert.rejects(anular(propietario,origenConcurrente._id),
   e=>e.statusCode===409 && /abonos activos/.test(e.message));
  // La anulación del abono devuelve simultáneamente dinero y cupo.
  const saldoPrevio=(await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor;
  await anular(propietario,abonoActivo._id,"Error de registro de prueba");
  const reservaLiberada=await ReservaCuota.findOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  }).lean();
  assert.equal(reservaLiberada.reservadoMinor,0);
  // Una reserva de monto cero sigue teniendo el importe original. No
  // reescribir el origen aunque ya no existan abonos activos.
  await assert.rejects(corregir(propietario,origenConcurrente._id,{
   montoMinor:49999
  }),e=>e.statusCode===409 && /reservas históricas/.test(e.message));
  await assert.rejects(corregir(propietario,origenConcurrente._id,{
   tipo:"INGRESO"
  }),e=>e.statusCode===409 && /reservas históricas/.test(e.message));
  assert.equal((await Transaccion.findById(origenConcurrente._id).lean()).montoMinor,50000);
  assert.equal((await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor,saldoPrevio+40000);
  const reingreso=await registrar(propietario,movimiento({
   recurrenteOrigenId:origenConcurrente._id,
   externalId:"reingreso-despues-anulacion",montoMinor:40000,
   cuenta:abonoActivo.cuenta
  }));
  assert.ok(reingreso._id);
  assert.equal((await ReservaCuota.findOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  }).lean()).reservadoMinor,40000);
  // Simular una reserva desincronizada fuera del servicio: el siguiente abono
  // no debe confirmar un débito ni ocultar el desajuste del ledger.
  await ReservaCuota.updateOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  },{$set:{reservadoMinor:39999}});
  const cajaAntesInconsistencia=(await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor;
  const transaccionesAntes=await Transaccion.countDocuments({usuarioId:propietario});
  await assert.rejects(registrar(propietario,movimiento({
   recurrenteOrigenId:origenConcurrente._id,externalId:"reserva-adulterada",
   montoMinor:1,cuenta:abonoActivo.cuenta
  })),e=>e.statusCode===409 && /desincronizada/.test(e.message));
  assert.equal(await Transaccion.countDocuments({usuarioId:propietario}),transaccionesAntes);
  assert.equal((await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor,cajaAntesInconsistencia);
  assert.equal((await ReservaCuota.findOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  }).lean()).reservadoMinor,39999,"La transacción fallida debe revertir su incremento");
  // Un exceso artificial tampoco puede liberarse durante una anulación.
  await ReservaCuota.updateOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  },{$set:{reservadoMinor:41000}});
  await assert.rejects(anular(propietario,reingreso._id),
   e=>e.statusCode===409 && /desincronizada/.test(e.message));
  assert.equal((await Transaccion.findById(reingreso._id).lean()).estado,"ACTIVA");
  assert.equal((await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor,cajaAntesInconsistencia);
  assert.equal((await ReservaCuota.findOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  }).lean()).reservadoMinor,41000);
  // Aun con la reserva monetaria restituida, una fecha de período
  // alterada invalida tanto nuevos pagos como anulaciones posteriores.
  await ReservaCuota.updateOne({
   usuarioId:propietario,origenId:origenConcurrente._id
  },{$set:{reservadoMinor:40000,periodoFin:new Date("2099-01-01T05:00:00Z")}});
  await assert.rejects(registrar(propietario,movimiento({
   recurrenteOrigenId:origenConcurrente._id,externalId:"periodo-alterado",
   montoMinor:1,cuenta:abonoActivo.cuenta
  })),e=>e.statusCode===409&&/fin de período inconsistente/.test(e.message));
  await assert.rejects(anular(propietario,reingreso._id),
   e=>e.statusCode===409&&/período o importe inconsistente/.test(e.message));
  assert.equal((await Transaccion.findById(reingreso._id).lean()).estado,"ACTIVA");
  assert.equal((await Cuenta.findOne({
   usuarioId:propietario,nombre:abonoActivo.cuenta
  }).lean()).saldoMinor,cajaAntesInconsistencia);
 }finally{
  await mongoose.disconnect();
  if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
 }
});
