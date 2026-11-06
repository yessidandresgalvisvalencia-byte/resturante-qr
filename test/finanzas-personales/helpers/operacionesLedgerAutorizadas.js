"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {registrarTransaccion,confirmarRegistroIntento,republicarPendientes}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const {crearAplicador}=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service");
const {consultarPeriodo,consultarCaja}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");

// La conexión la establece exclusivamente el fixture local autenticado. No crea
// índices ni eleva permisos; el administrador elimina toda la base al terminar.
async function probarCajaAutorizada(){
 const usuarioId=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId();
 const input={tipo:"INGRESO",montoMinor:10000,concepto:"Ingreso de prueba",categoria:"OTROS",
  moneda:"COP",subcategoria:"",cuenta:"PRUEBA_AUTH",medioPago:"TRANSFERENCIA",
  contraparte:"",descripcion:"",recurrente:false,frecuencia:"NINGUNA",origen:"MANUAL",
  fecha:new Date(Date.now()-60000),externalId:"ingreso-auth"};
 await registrarTransaccion(usuarioId,input);
 const cuenta=await Cuenta.findOne({usuarioId,nombre:input.cuenta}).lean();
 assert.equal(cuenta.saldoMinor,10000);
 assert.equal((await confirmarRegistroIntento(usuarioId,input)).confirmado,true);
 await assert.rejects(registrarTransaccion(usuarioId,input),e=>e.code===11000);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,10000);
 assert.equal(await Outbox.countDocuments({usuarioId}),1);
 await assert.rejects(confirmarRegistroIntento(usuarioId,{...input,montoMinor:10001}),e=>e.statusCode===409);
 assert.equal((await confirmarRegistroIntento(otro,input)).confirmado,false);
 const gastoInput={...input,tipo:"GASTO",montoMinor:3000,
  concepto:"Gasto de prueba",externalId:"gasto-auth"};
 const gasto=await registrarTransaccion(usuarioId,gastoInput);
 const original=await Tx.findById(gasto._id).lean();
 const fuentes=await Tx.find({usuarioId}).sort({_id:1}).lean();
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,7000);
 await assert.rejects(registrarTransaccion(usuarioId,{...input,tipo:"GASTO",montoMinor:8000,
  externalId:"sin-saldo-auth"}),e=>e.statusCode===409);
 assert.equal(await Tx.countDocuments({usuarioId}),2);
 assert.equal(await Outbox.countDocuments({usuarioId}),2);
 const aplicar=crearAplicador();
 const solicitud={usuarioId,movimientoId:String(gasto._id),tipo:"CORRECCION",
  cambios:{montoMinor:2500},idempotencyKey:"correccion-auth"};
 await assert.rejects(aplicar({...solicitud,usuarioId:otro}),e=>e.statusCode===404);
 const corregido=await aplicar(solicitud);
 assert.deepEqual(await confirmarRegistroIntento(usuarioId,gastoInput),{confirmado:false,estado:"CORREGIDA",existe:true});
 await assert.rejects(confirmarRegistroIntento(usuarioId,{...gastoInput,montoMinor:2500}),e=>e.statusCode===409);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,7500);
 assert.equal((await aplicar(solicitud)).hashActual,corregido.hashActual);
 await assert.rejects(aplicar({...solicitud,cambios:{montoMinor:2400}}),e=>e.statusCode===409);
 const periodo={usuarioId,desde:new Date(+input.fecha-1).toISOString(),hasta:new Date(Date.now()+60000).toISOString()};
 const efectivo=await consultarPeriodo(periodo);
 assert.equal(efectivo.find(f=>String(f._id)===String(gasto._id)).montoMinor,2500);
 assert.deepEqual(await consultarPeriodo({...periodo,usuarioId:otro}),[]);
 // Un fallo posterior al ajuste de cuenta debe revertir evento, cursor y saldo.
 const cursor=await Cursor.findById(String(usuarioId)).lean();
 const fallo=crearAplicador({OutboxModelo:{create:async()=>{throw Error("OUTBOX_AUTH_FALLIDO");}}});
 await assert.rejects(fallo({...solicitud,cambios:{montoMinor:2000},idempotencyKey:"rollback-auth"}),/OUTBOX_AUTH_FALLIDO/);
 assert.deepEqual(await Cursor.findById(String(usuarioId)).lean(),cursor);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,7500);
 assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),1);
 assert.equal(await Outbox.countDocuments({usuarioId}),3);
 const anulacion={...solicitud,tipo:"ANULACION",cambios:{},idempotencyKey:"anulacion-auth"};
 const anulado=await aplicar(anulacion);
 assert.deepEqual(await confirmarRegistroIntento(usuarioId,gastoInput),{confirmado:false,estado:"ANULADA",existe:true});
 assert.equal((await aplicar(anulacion)).hashActual,anulado.hashActual);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,10000);
 assert.equal((await consultarPeriodo(periodo)).length,1);
 assert.equal((await consultarPeriodo({...periodo,incluirAnuladas:true})).find(f=>String(f._id)===String(gasto._id)).estado,"ANULADA");
 const caja=await consultarCaja(usuarioId);
 assert.equal(caja.reduce((n,f)=>n+(f.tipo==="INGRESO"?BigInt(f.montoMinor):-BigInt(f.montoMinor)),0n),10000n);
 assert.deepEqual(await Tx.findById(gasto._id).lean(),original);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),fuentes);
 assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),2);
 assert.equal(await Outbox.countDocuments({usuarioId}),4);
 await republicarPendientes();
 assert.equal(await Outbox.countDocuments({usuarioId,estado:"PUBLICADO"}),4);
 // Pasar por el driver evita hooks: es MongoDB quien rechaza estas escrituras.
 await assert.rejects(Tx.collection.updateOne({_id:gasto._id},{$set:{montoMinor:1}}),e=>e.code===13);
 await assert.rejects(Evento.collection.deleteOne({usuarioId:String(usuarioId)}),e=>e.code===13);
 const cargado=await Tx.findById(gasto._id);
 await assert.rejects(cargado.updateOne({$set:{montoMinor:1}}),e=>e.code==="TRANSACCION_PERSONAL_APPEND_ONLY");
 // Mongoose permite omitir hooks: el rol MongoDB debe bloquear aun así.
 await assert.rejects(Tx.updateOne({_id:gasto._id},{$set:{montoMinor:1}},{middleware:false}),e=>e.code===13);
 await assert.rejects(cargado.updateOne({$set:{montoMinor:1}},{middleware:false}),e=>e.code===13);
 await assert.rejects(Tx.deleteOne({_id:gasto._id},{middleware:false}),e=>e.code===13);
 await assert.rejects(Tx.bulkWrite([{updateOne:{filter:{_id:gasto._id},update:{$set:{montoMinor:1}}}}],{middleware:false}),e=>e.code===13);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),fuentes);
}

async function probarCadenaV81Autorizada(){
 const {anexarEventoV81}=require("../../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
 const {verificarLedgerPersistidoV81}=require("../../../modules/finanzas-personales/services/verificacionLedgerV81.service");
 const Eventos=require("../../../modules/finanzas-personales/models/eventoV81.model");
 const usuarioId=new mongoose.Types.ObjectId();
 const datos={id:"evento-auth",tipo:"GASTO",montoCentavos:250030n,
  fechaContable:"2026-10-29",timestamp:"2026-10-29T10:00:00-05:00"};
 const original=await anexarEventoV81(usuarioId,datos);
 const fuente=await Eventos.findOne({usuarioId,eventId:datos.id}).lean();
 assert.equal((await anexarEventoV81(usuarioId,datos)).hashActual,original.hashActual);
 await assert.rejects(anexarEventoV81(usuarioId,{...datos,montoCentavos:250031n}),e=>e.statusCode===409);
 await anexarEventoV81(usuarioId,{...datos,id:"anulacion-auth",tipo:"ANULACION",montoCentavos:0n,
  corrigeId:datos.id,motivo:"Prueba con permisos restringidos"});
 assert.equal((await verificarLedgerPersistidoV81(usuarioId)).integridad,"VERIFICADA");
 assert.equal(await Eventos.countDocuments({usuarioId}),2);
 assert.deepEqual(await Eventos.findOne({usuarioId,eventId:datos.id}).lean(),fuente);
 await assert.rejects(Eventos.collection.updateOne({_id:fuente._id},{$set:{montoCentavos:"1"}}),e=>e.code===13);
}

async function probarIndicesEnCaliente(db){
 const {provisionarMongoPersonal}=require("../../../modules/finanzas-personales/security/provisionMongoPersonal.service");
 const usuarioId=new mongoose.Types.ObjectId();
 const input={tipo:"INGRESO",montoMinor:10000,concepto:"Prueba índices",categoria:"OTROS",
  cuenta:"INDICES_AUTH",medioPago:"TRANSFERENCIA",fecha:new Date(Date.now()-60000),externalId:"base-indices"};
 const tx=await registrarTransaccion(usuarioId,input);
 const estado=async()=>({
  fuentes:await Tx.find({usuarioId}).sort({_id:1}).lean(),
  cuentas:await Cuenta.find({usuarioId}).sort({_id:1}).lean(),
  eventos:await Evento.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).lean(),
  cursor:await Cursor.findById(String(usuarioId)).lean(),
  outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean()
 });
 const antes=await estado();
 // El administrador cambia índices; todas las operaciones de negocio siguen
 // usando la conexión restringida. Restaurar incluso si una aserción falla.
 async function conIndiceAlterado(coleccion,nombre,key,opciones,operacion){
  const col=db.collection(coleccion);
  await col.dropIndex(nombre);
  try{
   await col.createIndex(key,{...opciones,name:nombre});
   await assert.rejects(operacion(),e=>e.statusCode===503);
   assert.deepEqual(await estado(),antes);
  }finally{
   const indices=await col.indexes();
   if(indices.some(i=>i.name===nombre))await col.dropIndex(nombre);
   await provisionarMongoPersonal(db);
  }
 }
 await conIndiceAlterado("fin_transacciones_personales","usuarioId_1_externalIdHash_1",
  {usuarioId:1,externalIdHash:1},{unique:true,
   partialFilterExpression:{externalIdHash:{$type:"string"},origen:"MANUAL"}},
  ()=>registrarTransaccion(usuarioId,{...input,externalId:"rechazo-idempotencia"}));
 await conIndiceAlterado("fin_reservas_cuotas_recurrentes","usuarioId_1_origenId_1_periodoInicio_1",
  {usuarioId:1,origenId:1,periodoInicio:1},{unique:true,sparse:true},
  ()=>registrarTransaccion(usuarioId,{...input,tipo:"GASTO",externalId:"rechazo-reserva",
   recurrenteOrigenId:new mongoose.Types.ObjectId()}));
 await conIndiceAlterado("fin_eventos_compensatorios_personales_v1","fp_compensacion_orden_usuario_v1",
  {usuarioId:1,secuencia:1},{unique:true,collation:{locale:"en",strength:2}},
  ()=>crearAplicador()({usuarioId,movimientoId:String(tx._id),tipo:"CORRECCION",
   cambios:{montoMinor:9000},idempotencyKey:"rechazo-compensacion"}));
 // Restaurados los índices, la misma solicitud sí puede confirmarse.
 await crearAplicador()({usuarioId,movimientoId:String(tx._id),tipo:"CORRECCION",
  cambios:{montoMinor:9000},idempotencyKey:"rechazo-compensacion"});
 assert.equal((await Cuenta.findOne({usuarioId}).lean()).saldoMinor,9000);
 assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),1);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),antes.fuentes);
}
async function probarCadenaCompensatoriaAlterada(db){
 const usuarioId=new mongoose.Types.ObjectId();
 const input={tipo:"INGRESO",montoMinor:10000,concepto:"Integridad global",categoria:"OTROS",
  cuenta:"CADENA_AUTH",medioPago:"TRANSFERENCIA",fecha:new Date(Date.now()-60000)};
 const ingreso=await registrarTransaccion(usuarioId,{...input,externalId:"cadena-ingreso"});
 const gastoA=await registrarTransaccion(usuarioId,{...input,tipo:"GASTO",montoMinor:1000,externalId:"cadena-gasto-a"});
 const gastoB=await registrarTransaccion(usuarioId,{...input,tipo:"GASTO",montoMinor:2000,externalId:"cadena-gasto-b"});
 const aplicar=crearAplicador();
 const corregir=(movimientoId,montoMinor,idempotencyKey)=>({usuarioId,movimientoId:String(movimientoId),
  tipo:"CORRECCION",cambios:{montoMinor},idempotencyKey});
 await aplicar(corregir(gastoA._id,900,"cadena-a"));
 await aplicar(corregir(gastoB._id,1900,"cadena-b"));
 const eventos=db.collection("fin_eventos_compensatorios_personales_v1");
 const cursores=db.collection("fin_cursor_compensaciones_personales_v1");
 const cadena=await eventos.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).toArray();
 const cursor=await cursores.findOne({_id:String(usuarioId)});
 assert.equal(cadena.length,2);
 const estado=async()=>({
  fuentes:await Tx.find({usuarioId}).sort({_id:1}).lean(),
  cuentas:await Cuenta.find({usuarioId}).sort({_id:1}).lean(),
  eventos:await eventos.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).toArray(),
  cursor:await cursores.findOne({_id:String(usuarioId)}),
  outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean()
 });
 const intacto=await estado();
 const solicitud=corregir(ingreso._id,9000,"tras-alteracion");
 // Solo el administrador del fixture puede simular daños históricos. El
 // movimiento objetivo aún no tiene compensaciones: la verificación debe ser global.
 const ataques=[
  [()=>eventos.deleteOne({_id:cadena[0]._id}),()=>eventos.insertOne(cadena[0])],
  [()=>eventos.deleteOne({_id:cadena[1]._id}),()=>eventos.insertOne(cadena[1])],
  [()=>eventos.updateOne({_id:cadena[0]._id},{$set:{deltaCajaMinor:"1"}}),
   ()=>eventos.replaceOne({_id:cadena[0]._id},cadena[0])],
  [()=>cursores.updateOne({_id:cursor._id},{$set:{hashActual:"f".repeat(64)}}),
   ()=>cursores.replaceOne({_id:cursor._id},cursor)],
  [()=>cursores.deleteOne({_id:cursor._id}),()=>cursores.insertOne(cursor)]
 ];
 for(const [indice,[alterar,restaurar]] of ataques.entries()){
  await alterar();
  try{
   const antes=await estado();
   await assert.rejects(aplicar(solicitud),e=>e.statusCode===409&&/INTEGRIDAD_LEDGER/.test(e.message));
   // Reintentar un evento intacto tampoco debe ocultar daños en otro movimiento.
   const replay=indice===1?corregir(gastoA._id,900,"cadena-a"):corregir(gastoB._id,1900,"cadena-b");
   await assert.rejects(aplicar(replay),e=>e.statusCode===409&&/INTEGRIDAD_LEDGER/.test(e.message));
   assert.deepEqual(await estado(),antes);
  }finally{await restaurar();}
  assert.deepEqual(await estado(),intacto);
 }
 const confirmado=await aplicar(solicitud);
 assert.equal(confirmado.secuencia,3);
 assert.equal((await Cuenta.findOne({usuarioId}).lean()).saldoMinor,6200);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),intacto.fuentes);
}
module.exports={probarCajaAutorizada,probarCadenaV81Autorizada,probarIndicesEnCaliente,probarCadenaCompensatoriaAlterada};
