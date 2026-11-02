"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Reserva=require("../../../modules/finanzas-personales/models/reservaCuotaRecurrente.model");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {registrarTransaccion:registrar}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const {crearAplicador}=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service");
const {consultarPeriodo,consultarCaja}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {filtrar}=require("../../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
async function preparar(){
 const usuarioId=new mongoose.Types.ObjectId(),aplicar=crearAplicador();
 const datos={tipo:"GASTO",montoMinor:60,concepto:"Abono de ensayo",categoria:"HOGAR",moneda:"COP",
  cuenta:"ENSAYO_RECUPERACION",medioPago:"EFECTIVO",recurrente:false,frecuencia:"NINGUNA",fecha:new Date(Date.now()-60000),origen:"MANUAL"};
 await registrar(usuarioId,{...datos,tipo:"INGRESO",montoMinor:1000,externalId:"ingreso"});
 const origen=await Tx.create({usuarioId,tipo:"GASTO",recurrente:true,frecuencia:"MENSUAL",impactoCaja:false,
  fecha:new Date(Date.now()-35*86400000),montoMinor:100,concepto:"Cuota ficticia",categoria:"HOGAR",moneda:"COP"});
 const pago=await registrar(usuarioId,{...datos,recurrenteOrigenId:origen._id,externalId:"abono60"});
 await registrar(usuarioId,{...datos,recurrenteOrigenId:origen._id,montoMinor:40,externalId:"abono40"});
 const fuentes=await Tx.find({usuarioId}).sort({_id:1}).lean();
 const cuenta=await Cuenta.findOne({usuarioId}).lean();
 const anular=key=>aplicar({usuarioId,movimientoId:String(pago._id),tipo:"ANULACION",idempotencyKey:key});
 const anulacion=await anular("anular60");
 const solicitud={usuarioId,movimientoId:String(pago._id),tipo:"RESTAURACION",idempotencyKey:"restaurar60",anulacionHash:anulacion.hashActual};
 const foto=async()=>({cuenta:await Cuenta.findById(cuenta._id).lean(),reservas:await Reserva.find({usuarioId}).lean(),
  eventos:await Evento.find({usuarioId:String(usuarioId)}).lean(),cursor:await Cursor.findById(String(usuarioId)).lean(),
  outbox:await Outbox.find({usuarioId}).lean()});
 return{usuarioId,origen,pago,cuenta,fuentes,datos,aplicar,anular,solicitud,foto};
}
async function probarRestauracionRecurrenteAutorizada(){
 const c=await preparar(),otro=new mongoose.Types.ObjectId();
 assert.equal((await Reserva.findOne({usuarioId:c.usuarioId}).lean()).reservadoMinor,40);
 await assert.rejects(c.aplicar({...c.solicitud,usuarioId:otro}),e=>e.statusCode===404);
 const intentos=await Promise.allSettled([c.aplicar(c.solicitud),c.aplicar(c.solicitud)]);
 assert.ok(intentos.some(r=>r.status==="fulfilled"));
 const evento=await c.aplicar(c.solicitud);
 assert.equal((await c.aplicar(c.solicitud)).hashActual,evento.hashActual);
 assert.equal((await Cuenta.findById(c.cuenta._id).lean()).saldoMinor,900);
 assert.equal((await Reserva.findOne({usuarioId:c.usuarioId}).lean()).reservadoMinor,100);
 assert.equal(await Evento.countDocuments({usuarioId:String(c.usuarioId),tipo:"RESTAURACION"}),1);
 const auditoria=await Outbox.findOne({usuarioId:c.usuarioId,eventName:"MOVIMIENTO_RESTAURADO"}).lean();
 assert.equal(auditoria.payload.reservaRecurrente.reservadoMinor,100);
 assert.equal(auditoria.payload.reservaRecurrente.origenId,String(c.origen._id));
 const periodo={usuarioId:c.usuarioId,desde:new Date(Date.now()-40*86400000).toISOString(),hasta:new Date(Date.now()+60000).toISOString()};
 const activos=await consultarPeriodo(periodo);
 assert.equal(activos.filter(x=>String(x.recurrenteOrigenId)===String(c.origen._id)).reduce((n,x)=>n+x.montoMinor,0),100);
 const caja=await consultarCaja(c.usuarioId);
 assert.equal(caja.filter(x=>x.impactoCaja===true).reduce((n,x)=>n+(x.tipo==="INGRESO"?BigInt(x.montoMinor):-BigInt(x.montoMinor)),0n),900n);
 assert.deepEqual(await Tx.find({usuarioId:c.usuarioId}).sort({_id:1}).lean(),c.fuentes);
 const nueva=await c.anular("anular-otra-vez");
 const anulados=await consultarPeriodo({...periodo,incluirAnuladas:true});
 const vista=filtrar(anulados,{estado:"ANULADA",pagina:1});
 assert.equal(vista[0].recuperacion.anulacionHash,nueva.hashActual);
 await assert.rejects(c.aplicar({...c.solicitud,idempotencyKey:"referencia-antigua"}),e=>e.statusCode===409);
 const nuevoPago={...c.datos,recurrenteOrigenId:c.origen._id,externalId:"reemplazo60"};
 const carrera=await Promise.allSettled([
  c.aplicar({...c.solicitud,idempotencyKey:"restaurar-nuevo-ciclo",anulacionHash:nueva.hashActual}),
  registrar(c.usuarioId,nuevoPago)
 ]);
 assert.equal(carrera.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await Reserva.findOne({usuarioId:c.usuarioId}).lean()).reservadoMinor,100);
 assert.equal((await Cuenta.findById(c.cuenta._id).lean()).saldoMinor,900);
 const lleno=await c.foto();
 await assert.rejects(c.aplicar({...c.solicitud,idempotencyKey:"sin-cupo",anulacionHash:nueva.hashActual}),e=>e.statusCode===409);
 assert.deepEqual(await c.foto(),lleno);
 // Fallos después de reservar revierten también el cupo y dejan reintentar.
 const f=await preparar(),antes=await f.foto();
 const fallido=crearAplicador({OutboxModelo:{create:async()=>{throw Error("OUTBOX_RECUPERACION_FALLIDO");}}});
 await assert.rejects(fallido(f.solicitud),/OUTBOX_RECUPERACION_FALLIDO/);
 assert.deepEqual(await f.foto(),antes);
 await registrar(f.usuarioId,{...f.datos,montoMinor:950,externalId:"gasto-para-saldo"});
 const sinSaldo=await f.foto();await assert.rejects(f.aplicar(f.solicitud),e=>e.statusCode===409);
 assert.deepEqual(await f.foto(),sinSaldo);
 // Reserva mutable alterada solo en el ensayo: no puede repararse al restaurar.
 await Reserva.updateOne({usuarioId:f.usuarioId},{$set:{reservadoMinor:39}});
 const desfasado=await f.foto();await assert.rejects(f.aplicar(f.solicitud),e=>e.statusCode===409);
 assert.deepEqual(await f.foto(),desfasado);
 assert.deepEqual(await Tx.findById(f.pago._id).lean(),f.fuentes.find(x=>String(x._id)===String(f.pago._id)));
}
module.exports={probarRestauracionRecurrenteAutorizada};
