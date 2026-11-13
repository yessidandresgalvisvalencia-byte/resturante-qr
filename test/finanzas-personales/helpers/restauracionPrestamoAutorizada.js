"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const patrimonio=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service");
const service=require("../../../modules/finanzas-personales/services/reversionCuotaCreditoPersonal.service");
const {restaurarMovimiento}=require("../../../modules/finanzas-personales/services/restauracionMovimientoPersonal.service");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Evento=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {consultarCaja}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const historial=require("../../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
const {registrarTransaccion}=require("../../../modules/finanzas-personales/services/flujoCajaPersonal.service");
async function preparar({modo="CUENTA",principal=1000,real=450}={}){
 const usuarioId=new mongoose.Types.ObjectId(),fecha=new Date(Date.now()-3600000);
 const cuenta=await Cuenta.create({usuarioId,nombre:"Préstamo de ensayo",tipo:"EFECTIVO",saldoMinor:10000,
  saldoAnclaMinor:10000,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,origenSaldo:"USUARIO",requiereReconciliacion:false});
 const prestamo=await Prestamo.create({usuarioId,direccion:"POR_PAGAR",contraparte:"Ensayo",concepto:"Préstamo ficticio",
  principalMinor:principal,saldoMinor:principal,cuotaMinor:400,numeroCuotas:3,periodicidad:"MENSUAL",periodicidadConfirmada:true,
  fechaInicio:fecha,fechaVencimiento:new Date(Date.now()+86400000)});
 const datos={prestamoId:prestamo._id,cuentaId:modo==="CUENTA"?cuenta._id:null,numeroCuota:1,montoPagadoRealMinor:real,modo,externalId:crypto.randomUUID()};
 const pago=await patrimonio.pagarCuotaCredito(usuarioId,datos),movimientoId=String(pago.transaccion._id);
 const fuente=await Tx.findById(movimientoId).lean();
 const anular=key=>service.deshacer(usuarioId,prestamo._id,{movimientoId,idempotencyKey:key});
 const a=await anular("anular");
 const solicitud={usuarioId,movimientoId,tipo:"RESTAURACION",idempotencyKey:"restaurar",anulacionHash:a.compensacion.hashActual};
 const foto=async()=>({prestamo:await Prestamo.findById(prestamo._id).lean(),cuenta:await Cuenta.findById(cuenta._id).lean(),
  fuentes:await Tx.find({usuarioId}).sort({_id:1}).lean(),eventos:await Evento.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).lean(),
  cursor:await Cursor.findById(String(usuarioId)).lean(),outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean()});
 return{usuarioId,cuenta,prestamo,datos,pago,fuente,movimientoId,solicitud,foto,anular};
}
async function probarRestauracionPrestamoAutorizada(){
 for(const modo of ["CUENTA","HISTORICO"]){
  const f=await preparar({modo}),otro=new mongoose.Types.ObjectId();
  const vista=await historial.buscar(f.usuarioId,{estado:"ANULADA",pagina:1});assert.equal(vista[0].recuperacion.disponible,true);
  await assert.rejects(restaurarMovimiento({...f.solicitud,usuarioId:otro}),e=>e.statusCode===404);
  const intentos=await Promise.allSettled([restaurarMovimiento(f.solicitud),restaurarMovimiento(f.solicitud)]);
  assert.ok(intentos.some(x=>x.status==="fulfilled"));
  const e=await restaurarMovimiento(f.solicitud),foto=await f.foto();
  assert.equal(e.version,7);assert.equal(e.original.montoMinor,400);assert.equal(e.original.montoPagadoRealMinor,450);
  assert.equal(e.deltaCajaMinor,modo==="CUENTA"?"-450":"0");
  assert.equal(foto.prestamo.saldoMinor,600);assert.equal(foto.cuenta.saldoMinor,modo==="CUENTA"?9550:10000);
  assert.deepEqual(foto.fuentes,[f.fuente]);assert.equal(foto.eventos.length,2);
  const caja=await consultarCaja(f.usuarioId);
  if(modo==="CUENTA")assert.equal(patrimonio.saldoCuentasDesdeAnclas([foto.cuenta],caja),foto.cuenta.saldoMinor);
  else{
   // Caja cero no acredita la conciliación de un origen histórico desconocido.
   assert.equal(caja.filter(x=>x.impactoCaja===true).length,0);
   assert.throws(()=>patrimonio.saldoCuentasDesdeAnclas([foto.cuenta],caja),e=>e.statusCode===409);
  }
  assert.equal((await service.obtenerPagosCredito(f.usuarioId,f.prestamo._id)).totalPagadoRealMinor,450);
  assert.equal((await restaurarMovimiento(f.solicitud)).hashActual,e.hashActual);
  const despues=await f.foto();assert.deepEqual(despues,foto,"Repetir la restauración no modifica cursor, caja, préstamo, eventos ni fuente");
  await f.anular("anular2");const pendiente=await f.foto();
  await assert.rejects(restaurarMovimiento({...f.solicitud,idempotencyKey:"referencia-antigua"}),x=>x.statusCode===409);
  assert.deepEqual(await f.foto(),pendiente);
 }
 const final=await preparar({principal:400});await restaurarMovimiento(final.solicitud);
 const pagado=await Prestamo.findById(final.prestamo._id).lean();assert.equal(pagado.saldoMinor,0);assert.equal(pagado.estado,"PAGADO");assert.equal(pagado.periodicidadConfirmada,false);
 const parcial=await preparar({real:200});await restaurarMovimiento(parcial.solicitud);
 assert.equal((await Prestamo.findById(parcial.prestamo._id).lean()).saldoMinor,800);
 // Carrera entre recuperar la cuota anulada y registrar otro pago de esa cuota.
 const carrera=await preparar();
 const resultados=await Promise.allSettled([restaurarMovimiento(carrera.solicitud),patrimonio.pagarCuotaCredito(carrera.usuarioId,{...carrera.datos,externalId:crypto.randomUUID()})]);
 assert.equal(resultados.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await Prestamo.findById(carrera.prestamo._id).lean()).saldoMinor,600);
 assert.equal((await Cuenta.findById(carrera.cuenta._id).lean()).saldoMinor,9550);
 // Si falta la cuota 1, una cuota 2 anulada no puede restaurarse primero.
 const secuencia=await preparar();await restaurarMovimiento(secuencia.solicitud);
 const segundo=await patrimonio.pagarCuotaCredito(secuencia.usuarioId,{...secuencia.datos,numeroCuota:2,externalId:crypto.randomUUID()});
 const a2=await service.deshacer(secuencia.usuarioId,secuencia.prestamo._id,{movimientoId:segundo.transaccion._id,idempotencyKey:"anular-cuota2"});
 await secuencia.anular("anular-cuota1");const hueco=await secuencia.foto();
 await assert.rejects(restaurarMovimiento({...secuencia.solicitud,movimientoId:String(segundo.transaccion._id),idempotencyKey:"fuera-secuencia",anulacionHash:a2.compensacion.hashActual}),e=>e.statusCode===409);
 assert.deepEqual(await secuencia.foto(),hueco);
 // Fallos de outbox o caja revierten también deuda, cadena y originales.
 const f=await preparar(),antes=await f.foto(),crear=Outbox.create;
 Outbox.create=async()=>{throw Error("OUTBOX_RESTAURACION_PRESTAMO_FALLIDO");};
 try{await assert.rejects(restaurarMovimiento(f.solicitud),/OUTBOX_RESTAURACION_PRESTAMO_FALLIDO/);}finally{Outbox.create=crear;}
 assert.deepEqual(await f.foto(),antes);
 await registrarTransaccion(f.usuarioId,{tipo:"GASTO",montoMinor:10000,concepto:"Consumo de saldo de ensayo",categoria:"OTROS",cuenta:f.cuenta.nombre,
  moneda:"COP",medioPago:"EFECTIVO",fecha:new Date(),externalId:"consumir-saldo",origen:"MANUAL",recurrente:false,frecuencia:"NINGUNA"});
 const sinSaldo=await f.foto();await assert.rejects(restaurarMovimiento(f.solicitud),e=>e.statusCode===409);assert.deepEqual(await f.foto(),sinSaldo);
}
module.exports={probarRestauracionPrestamoAutorizada};
