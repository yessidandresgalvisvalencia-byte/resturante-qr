"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {registrarTransaccion}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const {crearAplicador}=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service");
const {consultarPeriodo,consultarCaja}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const historial=require("../../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
async function probarRestauracionCajaAutorizada(){
 const usuarioId=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId(),aplicar=crearAplicador();
 const datos={tipo:"INGRESO",montoMinor:10000,concepto:"Ensayo recuperación",categoria:"OTROS",moneda:"COP",
  cuenta:"ENSAYO_RESTAURAR",medioPago:"EFECTIVO",recurrente:false,frecuencia:"NINGUNA",fecha:new Date(Date.now()-60000),origen:"MANUAL"};
 const ingreso=await registrarTransaccion(usuarioId,{...datos,externalId:"ingreso-restaurar"});
 const gasto=await registrarTransaccion(usuarioId,{...datos,tipo:"GASTO",montoMinor:3000,externalId:"gasto-restaurar"});
 const fuentes=await Tx.find({usuarioId}).sort({_id:1}).lean(),cuenta=await Cuenta.findOne({usuarioId}).lean();
 const pedir=(tx,tipo,key,extra={})=>({usuarioId,movimientoId:String(tx._id),tipo,idempotencyKey:key,...extra});
 await aplicar(pedir(gasto,"CORRECCION","corregir",{cambios:{montoMinor:2500}}));
 const anular=await aplicar(pedir(gasto,"ANULACION","anular"));
 const borrados=await historial.buscar(usuarioId,{estado:"ANULADA",pagina:1});
 assert.equal(borrados.length,1);assert.equal(borrados[0].recuperacion.anulacionHash,anular.hashActual);
 const restaurar=pedir(gasto,"RESTAURACION","restaurar",{anulacionHash:anular.hashActual});
 await assert.rejects(aplicar({...restaurar,usuarioId:otro}),e=>e.statusCode===404);
 const intentos=await Promise.allSettled([aplicar(restaurar),aplicar(restaurar)]);
 assert.ok(intentos.some(x=>x.status==="fulfilled"));
 const confirmado=await aplicar(restaurar);
 assert.equal(confirmado.version,5);assert.equal(confirmado.deltaCajaMinor,"-2500");
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,7500);
 assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId),tipo:"RESTAURACION"}),1);
 assert.equal(await Outbox.countDocuments({usuarioId,eventName:"MOVIMIENTO_RESTAURADO"}),1);
 await assert.rejects(aplicar({...restaurar,idempotencyKey:"restaurar-otra"}),e=>e.statusCode===409);
 const periodo={usuarioId,desde:"2020-01-01T00:00:00.000Z",hasta:new Date(Date.now()+60000).toISOString()};
 assert.equal((await consultarPeriodo(periodo)).find(t=>String(t._id)===String(gasto._id)).montoMinor,2500);
 assert.equal((await historial.buscar(usuarioId,{estado:"ANULADA",pagina:1})).length,0);
 const caja=await consultarCaja(usuarioId);
 assert.equal(caja.reduce((n,t)=>n+(t.tipo==="INGRESO"?BigInt(t.montoMinor):-BigInt(t.montoMinor)),0n),7500n);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),fuentes);
 const nueva=await aplicar(pedir(gasto,"ANULACION","anular2"));
 await assert.rejects(aplicar({...restaurar,idempotencyKey:"hash-antiguo"}),e=>e.statusCode===409);
 // La repetición de la primera restauración solo devuelve su recibo, no restaura el ciclo nuevo.
 assert.equal((await aplicar(restaurar)).hashActual,confirmado.hashActual);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,10000);
 const foto=async()=>({cuenta:await Cuenta.findById(cuenta._id).lean(),eventos:await Evento.find({usuarioId:String(usuarioId)}).lean(),
  cursor:await Cursor.findById(String(usuarioId)).lean(),outbox:await Outbox.find({usuarioId}).lean()});
 const siguiente=pedir(gasto,"RESTAURACION","restaurar2",{anulacionHash:nueva.hashActual}),antes=await foto();
 const fallido=crearAplicador({OutboxModelo:{create:async()=>{throw Error("OUTBOX_RESTAURAR_FALLIDO");}}});
 await assert.rejects(fallido(siguiente),/OUTBOX_RESTAURAR_FALLIDO/);assert.deepEqual(await foto(),antes);
 await registrarTransaccion(usuarioId,{...datos,tipo:"GASTO",montoMinor:9000,externalId:"gasto-saldo-ensayo"});
 const sinSaldo=await foto();
 await assert.rejects(aplicar(siguiente),e=>e.statusCode===409);assert.deepEqual(await foto(),sinSaldo);
 await registrarTransaccion(usuarioId,{...datos,montoMinor:2000,externalId:"ingreso-saldo-ensayo"});
 const carreras=await Promise.allSettled([aplicar(siguiente),aplicar({...siguiente,idempotencyKey:"competidor"})]);
 assert.equal(carreras.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,500);
 assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId),tipo:"RESTAURACION"}),2);
 // Restauración de ingreso: revierte la anulación sin volver a insertar su fuente.
 const a=await aplicar(pedir(ingreso,"ANULACION","anular-ingreso")).catch(e=>{assert.equal(e.statusCode,409);return null;});
 assert.equal(a,null); // Su anulación necesitaría descontar 10.000 y no hay saldo.
 const nuevo=await registrarTransaccion(usuarioId,{...datos,montoMinor:1000,externalId:"ingreso-pequeno"});
 const anulado=await aplicar(pedir(nuevo,"ANULACION","anular-pequeno"));
 await aplicar(pedir(nuevo,"RESTAURACION","restaurar-pequeno",{anulacionHash:anulado.hashActual}));
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,1500);
 assert.deepEqual(await Tx.findById(gasto._id).lean(),fuentes.find(t=>String(t._id)===String(gasto._id)));
}
module.exports={probarRestauracionCajaAutorizada};
