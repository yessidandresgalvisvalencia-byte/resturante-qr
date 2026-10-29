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
 const gasto=await registrarTransaccion(usuarioId,{...input,tipo:"GASTO",montoMinor:3000,
  concepto:"Gasto de prueba",externalId:"gasto-auth"});
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
module.exports={probarCajaAutorizada,probarCadenaV81Autorizada};
