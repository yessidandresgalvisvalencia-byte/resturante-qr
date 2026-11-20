"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose");
const s=require("../../modules/finanzas-personales/services/correccionPrestamoPersonal.service"),E=require("../../modules/finanzas-personales/models/correccionPrestamoPersonal.model");
test("evidencia de corrección detecta cambios de solicitud, original, hash y cursor",()=>{
 const p={_id:new mongoose.Types.ObjectId(),usuarioId:new mongoose.Types.ObjectId(),principalMinor:1000,saldoMinor:1000};const cambios={principalMinor:1200},e={usuarioId:p.usuarioId,prestamoId:p._id,secuencia:1,solicitudId:"solicitud_01",solicitudHash:s.digest(cambios),cambios,anterior:s.foto(p),posterior:{principalMinor:1200,saldoMinor:1200},fecha:new Date(),hashAnterior:"0".repeat(64)};e.hashActual=s.hash(e);const actual={...p,correccionRevision:1,correccionHash:e.hashActual};assert.equal(s.verificar([e],actual),e);
 for(const malo of [{...e,anterior:{principalMinor:1}},{...e,cambios:{principalMinor:1300}},{...e,secuencia:2}])assert.throws(()=>s.verificar([malo],actual),/no verificable/);
 assert.throws(()=>s.verificar([],actual),/no verificable/);
});
test("validación estricta rechaza coerción, campos arbitrarios y falta de consentimiento",()=>{
 const u=new mongoose.Types.ObjectId(),p=new mongoose.Types.ObjectId(),sol={confirmacion:true,solicitudId:"solicitud_01"};assert.deepEqual(s.validar(u,p,{principalMinor:1200},sol),{principalMinor:1200});
 for(const cambios of [{principalMinor:"1200"},{principalMinor:1.2},{saldoMinor:1},{}])assert.throws(()=>s.validar(u,p,cambios,sol),e=>e.statusCode===422);
 assert.throws(()=>s.validar(u,p,{concepto:"Otro"},{...sol,confirmacion:false}),e=>e.statusCode===400);
});
test("modelo de corrección prohíbe modificar consultas y documentos existentes",async()=>{
 for(const op of [()=>E.updateOne({},{$set:{secuencia:2}}),()=>E.deleteMany({}),()=>E.bulkWrite([])])await assert.rejects(op(),/CORRECCION_PRESTAMO_APPEND_ONLY/);
 const d=E.hydrate({_id:new mongoose.Types.ObjectId(),usuarioId:new mongoose.Types.ObjectId(),prestamoId:new mongoose.Types.ObjectId(),secuencia:1,solicitudId:"solicitud_01",solicitudHash:"a".repeat(64),cambios:{concepto:"Otro"},anterior:{},posterior:{},fecha:new Date(),hashAnterior:"0".repeat(64),hashActual:"a".repeat(64)});await assert.rejects(d.save(),/CORRECCION_PRESTAMO_APPEND_ONLY/);
});
test("PATCH toma identidad del servidor y separa clave/consentimiento de los cambios",async()=>{
 const patrimonio=require("../../modules/finanzas-personales/services/patrimonioPersonal.service"),router=require("../../modules/finanzas-personales/routes"),handlers=router.stack.find(x=>x.route?.path==="/prestamos/:id"&&x.route.methods.patch).route.stack;
 const handler=handlers.at(-1).handle,original=patrimonio.corregirPrestamo;let llamada;
 const res={status(n){this.codigo=n;return this;},json(v){this.value=v;return this;}};
 try{patrimonio.corregirPrestamo=async(...a)=>{llamada=a;return{};};await handler({personalAuth:{userId:"propietario"},params:{id:"a".repeat(24)},validated:{concepto:"Otro"},body:{confirmacion:true,usuarioId:"ajeno"},get:()=>"solicitud_01"},res);assert.equal(llamada[0],"propietario");assert.deepEqual(llamada[2],{concepto:"Otro"});assert.deepEqual(llamada[3],{confirmacion:true,solicitudId:"solicitud_01"});
 }finally{patrimonio.corregirPrestamo=original;}
});
