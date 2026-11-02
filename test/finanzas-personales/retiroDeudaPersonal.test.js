"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose");
const servicio=require("../../modules/finanzas-personales/services/retiroDeudaPersonal.service"),Evento=require("../../modules/finanzas-personales/models/retiroDeudaPersonal.model");
function preparar(){
 const p={_id:new mongoose.Types.ObjectId(),usuarioId:new mongoose.Types.ObjectId(),retiroRevision:0,retiroHash:null,estado:"ACTIVO",periodicidadConfirmada:true,diaPago:31,principalMinor:1000,saldoMinor:1000,fechaInicio:new Date("2026-01-01T00:00:00Z")};
 const anterior=servicio.foto(p),posterior={...anterior,estado:"CANCELADO",periodicidadConfirmada:false};
 const e={usuarioId:p.usuarioId,prestamoId:p._id,secuencia:1,solicitudId:"retiro_001",tipo:"RETIRO",referencia:null,anterior,posterior,fecha:new Date(),hashAnterior:"0".repeat(64)};e.hashActual=servicio.hash(e);
 return{p:{...p,...posterior,retiroRevision:1,retiroHash:e.hashActual},e};
}
test("cadena por deuda conserva snapshots y rechaza alteración, truncamiento y cursor incoherente",()=>{
 const {p,e}=preparar();assert.equal(servicio.verificar([e],p),e);
 for(const mal of [{...e,anterior:{...e.anterior,saldoMinor:999}},{...e,secuencia:2},{...e,usuarioId:new mongoose.Types.ObjectId()}])assert.throws(()=>servicio.verificar([mal],p),/no verificable/);
 assert.throws(()=>servicio.verificar([],p),/no verificable/);assert.throws(()=>servicio.verificar([e],{...p,retiroRevision:0}),/no verificable/);
 const r={...e,secuencia:2,solicitudId:"restaurar_001",tipo:"RESTAURACION",referencia:e.hashActual,anterior:e.posterior,posterior:e.anterior,hashAnterior:e.hashActual};r.hashActual=servicio.hash(r);
 assert.equal(servicio.verificar([e,r],{...p,retiroRevision:2,retiroHash:r.hashActual}),r);
});
test("historial de retiro rechaza mutación desde consultas y documentos",async()=>{
 for(const op of [()=>Evento.updateOne({},{$set:{tipo:"RETIRO"}}),()=>Evento.deleteMany({}),()=>Evento.replaceOne({},{}),()=>Evento.bulkWrite([])])await assert.rejects(op(),/RETIRO_DEUDA_APPEND_ONLY/);
 const doc=Evento.hydrate({...preparar().e,_id:new mongoose.Types.ObjectId()});await assert.rejects(doc.save(),/RETIRO_DEUDA_APPEND_ONLY/);
});
test("servicio rechaza ausencia de confirmación y referencias antes de abrir MongoDB",async()=>{
 await assert.rejects(servicio.retirar("x","y",{}),e=>e.statusCode===400);
 await assert.rejects(servicio.restaurar(new mongoose.Types.ObjectId(),new mongoose.Types.ObjectId(),{confirmacion:true,solicitudId:"restauracion"}),e=>e.statusCode===400);
});
test("ruta de recuperación usa identidad autenticada e informa fallo seguro; legacy conserva datos",async()=>{
 const router=require("../../modules/finanzas-personales/routes"),path="/prestamos/:id/restaurar-retiro";
 const handler=router.stack.find(x=>x.route?.path===path).route.stack[0].handle;
 const original=servicio.restaurar;let llamada;
 const res={codigo:200,status(n){this.codigo=n;return this;},json(x){this.jsonResultado=x;return this;}};
 try{
  servicio.restaurar=async(...args)=>{llamada=args;return{vigente:true};};
  const req={personalAuth:{userId:"propietario"},params:{id:"deuda"},body:{usuarioId:"ajeno",confirmacion:true}};await handler(req,res);assert.equal(llamada[0],"propietario");assert.equal(llamada[1],"deuda");
  servicio.restaurar=async()=>{throw Error("secreto de conexión");};await handler(req,res);assert.equal(res.codigo,500);assert.equal(res.jsonResultado.error,"No fue posible recuperar la deuda");
  const legacy=router.stack.find(x=>x.route?.path==="/creditos/:id"&&x.route.methods.delete).route.stack[0].handle;await legacy({},res);assert.equal(res.codigo,409);
 }finally{servicio.restaurar=original;}
});
