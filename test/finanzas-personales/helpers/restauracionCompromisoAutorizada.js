"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const service=require("../../../modules/finanzas-personales/services/compromisosCuotas.service");
const {restaurarMovimiento}=require("../../../modules/finanzas-personales/services/restauracionMovimientoPersonal.service");
const Padre=require("../../../modules/finanzas-personales/models/compromisoCuotas.model");
const Cuota=require("../../../modules/finanzas-personales/models/cuotaHija.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {consultarPeriodo,consultarCaja}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const historial=require("../../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
const {registrarTransaccion}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
async function preparar(modo="CUENTA",n=3){
 const usuarioId=new mongoose.Types.ObjectId();
 const cuenta=await Cuenta.create({usuarioId,nombre:"Cuotas ensayo",tipo:"EFECTIVO",saldoMinor:10000});
 const padre=await service.crear(usuarioId,{concepto:"Compra de ensayo",categoria:"HOGAR",montoTotalMinor:1001,numeroCuotas:n});
 const datos={compromisoId:String(padre._id),numero:1,modo,cuentaId:modo==="CUENTA"?cuenta._id:null,externalId:crypto.randomUUID()};
 const pago=await service.pagar(usuarioId,datos),movimientoId=String(pago.transaccion._id);
 const fuente=await Tx.findById(movimientoId).lean();
 const anular=key=>service.deshacer(usuarioId,{compromisoId:datos.compromisoId,numero:1,movimientoId,idempotencyKey:key});
 const a=await anular("anular");
 const solicitud={usuarioId,movimientoId,tipo:"RESTAURACION",idempotencyKey:"recuperar",anulacionHash:a.compensacion.hashActual};
 const foto=async()=>({padre:await Padre.findById(padre._id).lean(),cuotas:await Cuota.find({usuarioId}).sort({numero:1}).lean(),
  cuenta:await Cuenta.findById(cuenta._id).lean(),tx:await Tx.find({usuarioId}).lean(),
  eventos:await Evento.find({usuarioId:String(usuarioId)}).lean(),cursor:await Cursor.findById(String(usuarioId)).lean(),outbox:await Outbox.find({usuarioId}).lean()});
 return{usuarioId,cuenta,padre,datos,pago,fuente,movimientoId,solicitud,foto,anular};
}
async function probarRestauracionCompromisoAutorizada(){
 for(const modo of ["CUENTA","HISTORICO"]){
  const f=await preparar(modo),otro=new mongoose.Types.ObjectId();
  const vista=await historial.buscar(f.usuarioId,{estado:"ANULADA",pagina:1});
  assert.equal(vista[0].recuperacion.anulacionHash,f.solicitud.anulacionHash);
  await assert.rejects(restaurarMovimiento({...f.solicitud,usuarioId:otro}),e=>e.statusCode===404);
  const intentos=await Promise.allSettled([restaurarMovimiento(f.solicitud),restaurarMovimiento(f.solicitud)]);
  assert.ok(intentos.some(x=>x.status==="fulfilled"));
  const e=await restaurarMovimiento(f.solicitud);assert.equal(e.version,6);assert.equal(e.deltaCajaMinor,modo==="CUENTA"?"-334":"0");
  const estado=await f.foto();assert.equal(estado.padre.saldoMinor,667);assert.equal(estado.padre.cuotasPagadas,1);
  assert.equal(estado.cuotas[0].estado,"PAGADA");assert.equal(String(estado.cuotas[0].transaccionId),f.movimientoId);
  assert.equal(+estado.cuotas[0].pagadaEn,+f.fuente.fecha);assert.equal(estado.cuenta.saldoMinor,modo==="CUENTA"?9666:10000);
  assert.equal(estado.eventos.length,2);assert.deepEqual(estado.tx,[f.fuente]);
  assert.equal((await restaurarMovimiento(f.solicitud)).hashActual,e.hashActual);assert.deepEqual(await f.foto(),estado);
  const periodo={usuarioId:f.usuarioId,desde:"2020-01-01T00:00:00.000Z",hasta:new Date(Date.now()+60000).toISOString()};
  assert.equal((await consultarPeriodo(periodo)).length,1);
  assert.equal((await consultarCaja(f.usuarioId)).filter(x=>x.impactoCaja).reduce((n,x)=>n+(x.tipo==="INGRESO"?BigInt(x.montoMinor):-BigInt(x.montoMinor)),0n),modo==="CUENTA"?-334n:0n);
  const a=await f.anular("anular2"),pendiente=await f.foto();
  await assert.rejects(restaurarMovimiento({...f.solicitud,idempotencyKey:"referencia-vieja"}),x=>x.statusCode===409);
  assert.equal((await restaurarMovimiento(f.solicitud)).hashActual,e.hashActual);assert.deepEqual(await f.foto(),pendiente);
  assert.notEqual(a.compensacion.hashActual,f.solicitud.anulacionHash);
 }
 const final=await preparar("CUENTA",1);await restaurarMovimiento(final.solicitud);
 assert.equal((await Padre.findById(final.padre._id).lean()).estado,"FINALIZADA");
 assert.equal((await Padre.findById(final.padre._id).lean()).saldoMinor,0);
 // Pago nuevo y restauración compiten por el mismo calendario y cuenta.
 const carrera=await preparar();
 const resultados=await Promise.allSettled([restaurarMovimiento(carrera.solicitud),service.pagar(carrera.usuarioId,{...carrera.datos,externalId:crypto.randomUUID()})]);
 assert.equal(resultados.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await Padre.findById(carrera.padre._id).lean()).cuotasPagadas,1);
 assert.equal((await Cuenta.findById(carrera.cuenta._id).lean()).saldoMinor,9666);
 const despues=await carrera.foto();
 await assert.rejects(restaurarMovimiento({...carrera.solicitud,idempotencyKey:"otro-intento"}),x=>x.statusCode===409);
 assert.deepEqual(await carrera.foto(),despues);
 // Fallar después de restaurar cuota, padre y caja debe revertir todo.
 const f=await preparar(),antes=await f.foto(),crear=Outbox.create;
 Outbox.create=async()=>{throw Error("OUTBOX_CUOTA_RESTAURADA_FALLIDO");};
 try{await assert.rejects(restaurarMovimiento(f.solicitud),/OUTBOX_CUOTA_RESTAURADA_FALLIDO/);}finally{Outbox.create=crear;}
 assert.deepEqual(await f.foto(),antes);
 await registrarTransaccion(f.usuarioId,{tipo:"GASTO",montoMinor:10000,concepto:"Gasto de saldo de ensayo",categoria:"OTROS",cuenta:f.cuenta.nombre,
  medioPago:"EFECTIVO",moneda:"COP",fecha:new Date(),externalId:"consumir-saldo",recurrente:false,frecuencia:"NINGUNA",origen:"MANUAL"});
 const sinSaldo=await f.foto();await assert.rejects(restaurarMovimiento(f.solicitud),x=>x.statusCode===409);assert.deepEqual(await f.foto(),sinSaldo);
}
module.exports={probarRestauracionCompromisoAutorizada};
