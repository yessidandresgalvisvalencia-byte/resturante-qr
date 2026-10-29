"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Borrador=require("../../../modules/finanzas-personales/models/borradorFinanciero.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const {aprobar}=require("../../../modules/finanzas-personales/services/aprobacionConversacional.service");
const {corregirOrigenTrabajo}=require("../../../modules/finanzas-personales/services/reclasificarTrabajoCompensadoPersonal.service");
const {consultarPeriodo}=require("../../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
async function probarCobrosConversacionalesAutorizados(){
 const fecha=new Date(Date.now()-60000);
 const prestamo=(usuarioId,origenCuentaPorCobrar="PRESTAMO")=>Prestamo.create({usuarioId,direccion:"POR_COBRAR",
  origenCuentaPorCobrar,contraparte:"Persona de prueba",concepto:"Cuenta de prueba",principalMinor:1000,saldoMinor:1000,fechaInicio:fecha});
 const borrador=(usuarioId,montoMinor,fechaCobro=fecha)=>Borrador.create({usuarioId,canal:"TEXTO",textoOriginal:"Cobro local",
  items:[{tipo:"COBRO_CUENTA_POR_COBRAR",montoMinor,concepto:"Cobro de prueba",categoria:"OTROS",
   contraparte:"Persona de prueba",fecha:fechaCobro,confianza:100,estado:"LISTO"}]});
 const estado=async usuarioId=>({
  prestamos:await Prestamo.find({usuarioId}).sort({_id:1}).lean(),
  cuentas:await Cuenta.find({usuarioId}).sort({_id:1}).lean(),
  tx:await Tx.find({usuarioId}).sort({_id:1}).lean(),
  outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean(),
  borradores:await Borrador.find({usuarioId}).sort({_id:1}).lean()
 });
 const usuarioId=new mongoose.Types.ObjectId(),p=await prestamo(usuarioId);
 const a=await borrador(usuarioId,400);await aprobar(usuarioId,a._id);
 assert.equal((await Prestamo.findById(p._id).lean()).saldoMinor,600);
 const b=await borrador(usuarioId,600);await aprobar(usuarioId,b._id);
 const cuenta=await Cuenta.findOne({usuarioId,nombre:"EFECTIVO"}).lean();
 assert.equal(cuenta.saldoMinor,1000);
 const pagado=await Prestamo.findById(p._id).lean();assert.equal(pagado.saldoMinor,0);assert.equal(pagado.estado,"PAGADO");
 const originales=await Tx.find({usuarioId}).sort({_id:1}).lean();assert.equal(originales.length,2);
 for(const tx of originales){
  assert.equal(tx.tipo,"COBRO_PRESTAMO");assert.equal(String(tx.prestamoId),String(p._id));
  assert.equal(String(tx.cuentaId),String(cuenta._id));assert.equal(tx.impactoCaja,true);
 }
 const antesReintento=await estado(usuarioId);
 await assert.rejects(aprobar(usuarioId,b._id),e=>e.statusCode===404);
 assert.deepEqual(await estado(usuarioId),antesReintento);
 // Los cobros nuevos conservan la identidad necesaria para reclasificar sin duplicar caja.
 assert.equal((await corregirOrigenTrabajo(usuarioId,p._id)).reclasificados,2);
 assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,1000);
 assert.deepEqual(await Tx.find({usuarioId}).sort({_id:1}).lean(),originales);
 const lectura=await consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"});
 assert.ok(lectura.every(t=>t.tipo==="INGRESO"));
 const trabajo=new mongoose.Types.ObjectId();await prestamo(trabajo,"TRABAJO");
 await aprobar(trabajo,(await borrador(trabajo,1000))._id);
 assert.equal((await Tx.findOne({usuarioId:trabajo}).lean()).tipo,"INGRESO");
 // Dos cobros sobre el mismo saldo no pueden cobrar de más bajo concurrencia.
 const carrera=new mongoose.Types.ObjectId(),pc=await prestamo(carrera);
 const drafts=await Promise.all([borrador(carrera,700),borrador(carrera,700)]);
 const intentos=await Promise.allSettled(drafts.map(d=>aprobar(carrera,d._id)));
 assert.equal(intentos.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await Prestamo.findById(pc._id).lean()).saldoMinor,300);
 assert.equal((await Cuenta.findOne({usuarioId:carrera}).lean()).saldoMinor,700);
 assert.equal(await Tx.countDocuments({usuarioId:carrera}),1);
 // Ambigüedad, deuda ajena, exceso y fechas futuras no dejan efectos parciales.
 for(const caso of ["ambiguo","ajeno","exceso","futuro","overflow","outbox"]){
  const user=new mongoose.Types.ObjectId();
  if(caso!=="ajeno")await prestamo(user);
  if(caso==="ambiguo")await prestamo(user);
  if(caso==="overflow")await Cuenta.create({usuarioId:user,nombre:"EFECTIVO",tipo:"EFECTIVO",saldoMinor:Number.MAX_SAFE_INTEGER});
  const d=await borrador(user,caso==="exceso"?1001:100,caso==="futuro"?new Date(Date.now()+86400000):fecha);
  const antes=await estado(user),crear=Outbox.create;
  if(caso==="outbox")Outbox.create=async()=>{throw Error("OUTBOX_COBRO_FALLIDO");};
  try{
   await assert.rejects(aprobar(user,d._id),e=>caso==="outbox"?e.message==="OUTBOX_COBRO_FALLIDO":[409,422].includes(e.statusCode));
  }finally{Outbox.create=crear;}
  assert.deepEqual(await estado(user),antes);
 }
}
module.exports={probarCobrosConversacionalesAutorizados};
