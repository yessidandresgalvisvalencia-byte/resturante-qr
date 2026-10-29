"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Borrador=require("../../../modules/finanzas-personales/models/borradorFinanciero.model");
const Prestamo=require("../../../modules/finanzas-personales/models/prestamoPersonal.model");
const Activo=require("../../../modules/finanzas-personales/models/ActivoPatrimonial");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {aprobar}=require("../../../modules/finanzas-personales/services/aprobacionConversacional.service");
async function probarDeudasConversacionalesAutorizadas(){
 const usuarioId=new mongoose.Types.ObjectId();
 const item={tipo:"DEUDA_POR_PAGAR",montoMinor:1000,principalMinor:1000,saldoMinor:600,
  abonadoMinor:400,cuotaMinor:200,concepto:"Moto",categoria:"Deuda",fecha:new Date(),confianza:100,estado:"LISTO"};
 const crear=cambios=>Borrador.create({usuarioId,canal:"TEXTO",textoOriginal:"Deuda local",items:[{...item,...cambios}]});
 const estado=async()=>({deudas:await Prestamo.find({usuarioId}).sort({_id:1}).lean(),
  activos:await Activo.find({usuarioId}).lean(),tx:await Tx.find({usuarioId}).lean(),
  outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean(),borradores:await Borrador.find({usuarioId}).sort({_id:1}).lean()});
 const b=await crear({});await aprobar(usuarioId,b._id);
 const p=await Prestamo.findOne({usuarioId}).lean();
 assert.equal(p.principalMinor,1000);assert.equal(p.saldoMinor,600);assert.equal(p.tasaConfirmada,false);
 assert.equal(p.fechaVencimiento,null);assert.equal(p.periodicidadConfirmada,false);
 const programada=await crear({diaPago:31,frecuencia:"MENSUAL"});
 const aprobada=await aprobar(usuarioId,programada._id);
 const calendario=await Prestamo.findById(aprobada.operaciones[0].id).lean();
 assert.equal(calendario.diaPago,31);assert.equal(calendario.periodicidad,"MENSUAL");
 assert.equal(calendario.periodicidadConfirmada,true);assert.ok(calendario.fechaVencimiento instanceof Date);
 assert.equal(await Activo.countDocuments({usuarioId}),0,"La deuda de una moto no demuestra su valor actual");
 assert.equal(await Tx.countDocuments({usuarioId}),0,"Registrar deuda existente no genera caja");
 const pagada=await crear({saldoMinor:0,abonadoMinor:1000});await aprobar(usuarioId,pagada._id);
 assert.equal(await Prestamo.countDocuments({usuarioId,estado:"PAGADO",saldoMinor:0}),1);
 for(const cambio of [{saldoMinor:1001},{principalMinor:1000.5},{cuotaMinor:1.5},{abonadoMinor:399}]){
  const d=await crear(cambio),antes=await estado();
  await assert.rejects(aprobar(usuarioId,d._id),e=>e.statusCode===422);
  assert.deepEqual(await estado(),antes);
 }
 const d=await crear({}),antes=await estado(),original=Outbox.create;
 Outbox.create=async()=>{throw Error("OUTBOX_DEUDA_FALLIDO");};
 try{await assert.rejects(aprobar(usuarioId,d._id),/OUTBOX_DEUDA_FALLIDO/);}finally{Outbox.create=original;}
 assert.deepEqual(await estado(),antes);
}
module.exports={probarDeudasConversacionalesAutorizadas};
