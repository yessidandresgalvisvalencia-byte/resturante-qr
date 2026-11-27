"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Borrador=require("../../../modules/finanzas-personales/models/borradorFinanciero.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const {aprobar}=require("../../../modules/finanzas-personales/services/aprobacionConversacional.service");
const aplicar=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service").crearAplicador();
// Solo se invoca con la conexión restringida del replica set local autenticado.
async function probarAprobacionConversacionalAutorizada(){
 const usuarioId=new mongoose.Types.ObjectId();
 const item=(tipo,montoMinor)=>({tipo,montoMinor,concepto:"Prueba conversacional",categoria:"OTROS",
  fecha:new Date(Date.now()-60000),confianza:100,estado:"LISTO"});
 const borrador=(user,items)=>Borrador.create({usuarioId:user,canal:"TEXTO",textoOriginal:"Prueba local",items});
 const estado=async user=>({
  tx:await Tx.find({usuarioId:user}).sort({_id:1}).lean(),
  cuentas:await Cuenta.find({usuarioId:user}).sort({_id:1}).lean(),
  outbox:await Outbox.find({usuarioId:user}).sort({_id:1}).lean(),
  prestamos:await Prestamo.find({usuarioId:user}).sort({_id:1}).lean(),
  borradores:await Borrador.find({usuarioId:user}).sort({_id:1}).lean()
 });
 const b=await borrador(usuarioId,[item("INGRESO",10000),item("GASTO",3000)]);
 await assert.rejects(aprobar(new mongoose.Types.ObjectId(),b._id),e=>e.statusCode===404);
 const resultado=await aprobar(usuarioId,b._id);
 assert.equal(resultado.estado,"APROBADO");assert.equal(resultado.operaciones.length,2);
 const cuenta=await Cuenta.findOne({usuarioId,nombre:"EFECTIVO"}).lean();
 assert.equal(cuenta.saldoMinor,7000);
 const fuentes=await Tx.find({usuarioId}).sort({_id:1}).lean();
 assert.equal(fuentes.length,2);
 for(const fuente of fuentes){
  assert.equal(String(fuente.cuentaId),String(cuenta._id));
  assert.equal(fuente.cuenta,"EFECTIVO");assert.equal(fuente.impactoCaja,true);
 }
 const gasto=fuentes.find(f=>f.tipo==="GASTO");
 const solicitud={usuarioId,movimientoId:String(gasto._id),tipo:"CORRECCION",
  cambios:{montoMinor:2500},idempotencyKey:"corregir-conversacional"};
 await aplicar(solicitud);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,7500);
 await aplicar({...solicitud,tipo:"ANULACION",cambios:{},idempotencyKey:"anular-conversacional"});
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,10000);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),fuentes);
 const trasCompensar=await estado(usuarioId);
 await assert.rejects(aprobar(usuarioId,b._id),e=>e.statusCode===404);
 assert.deepEqual(await estado(usuarioId),trasCompensar);
 // La primera inserción del lote también se revierte si el segundo gasto falla.
 const sinSaldo=await borrador(usuarioId,[item("INGRESO",100),item("GASTO",50000)]);
 const antes=await estado(usuarioId);
 await assert.rejects(aprobar(usuarioId,sinSaldo._id),e=>e.statusCode===409);
 assert.deepEqual(await estado(usuarioId),antes);
 for(const monto of [1.5,Number.MAX_SAFE_INTEGER+1]){
  const user=new mongoose.Types.ObjectId(),b=await borrador(user,[item("INGRESO",monto)]);
  const antes=await estado(user);
  await assert.rejects(aprobar(user,b._id),e=>e.statusCode===422);
  assert.deepEqual(await estado(user),antes);
 }
 for(const tipo of ["PAGO_DEUDA","PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"]){
  const user=new mongoose.Types.ObjectId(),b=await borrador(user,[item(tipo,100)]);
  const antes=await estado(user);
  await assert.rejects(aprobar(user,b._id),e=>e.statusCode===409);
  assert.deepEqual(await estado(user),antes);
 }
 const user=new mongoose.Types.ObjectId();
 await Cuenta.create({usuarioId:user,nombre:"EFECTIVO",tipo:"EFECTIVO",saldoMinor:Number.MAX_SAFE_INTEGER});
 const exceso=await borrador(user,[item("INGRESO",1)]),antesExceso=await estado(user);
 await assert.rejects(aprobar(user,exceso._id),e=>e.statusCode===409);
 assert.deepEqual(await estado(user),antesExceso);
}
module.exports={probarAprobacionConversacionalAutorizada};
