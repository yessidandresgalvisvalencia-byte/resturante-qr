"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const s=require("../../modules/finanzas-personales/services/reciboAprobacionPersonal.service"),R=require("../../modules/finanzas-personales/models/reciboAprobacionPersonal.model");
function fixture(){
 const usuarioId=new mongoose.Types.ObjectId(),borradorId=new mongoose.Types.ObjectId(),itemId=new mongoose.Types.ObjectId(),tx=new mongoose.Types.ObjectId();
 const fuente={_id:String(tx),montoMinor:100,tipo:"INGRESO",usuarioId:String(usuarioId)},huella=crypto.createHash("sha256").update(JSON.stringify(fuente)).digest("hex");
 const r={usuarioId,borradorId,itemId:null,solicitudId:"aprobacion_prueba",solicitudHash:s.solicitudHash(borradorId,null,"2026-11-02T00:00:00.000Z"),itemIds:[itemId],original:{_id:String(borradorId),usuarioId:String(usuarioId),updatedAt:"2026-11-02T00:00:00.000Z",items:[]},resultado:{borradorId:String(borradorId),operaciones:[{tipo:"INGRESO",id:String(tx)}]},fuentes:[{modelo:"TRANSACCION",id:String(tx),original:fuente,hash:huella}],fecha:new Date()};r.solicitudHash=s.solicitudHash(borradorId,null,s.versionBorrador(r.original));r.hashActual=s.hash(r);return r;
}
test("recibo detecta cambios de resultado, fuente y propietario; el resumen no certifica saldo actual",()=>{
 const r=fixture();assert.equal(s.verificar(r),r);assert.equal(s.resumen(r).certificaEstadoActual,false);
 for(const cambiado of [{...r,resultado:{estado:"FALSO"}},{...r,fuentes:[]},{...r,solicitudHash:"f".repeat(64)}])assert.throws(()=>s.verificar(cambiado),/no verificable/);
 const ajeno={...r,original:{...r.original,usuarioId:String(new mongoose.Types.ObjectId())}};ajeno.hashActual=s.hash(ajeno);assert.throws(()=>s.verificar(ajeno),/no verificable/);
});
test("confirmación y claves se validan antes de abrir transacción; modelo prohíbe mutación",async()=>{
 const r=fixture();assert.throws(()=>s.validarSolicitud(r.usuarioId,r.borradorId,null,{confirmacion:false,solicitudId:r.solicitudId}),e=>e.statusCode===400);
 for(const op of [()=>R.updateOne({},{$set:{solicitudId:"otro"}}),()=>R.deleteMany({}),()=>R.bulkWrite([])])await assert.rejects(op(),/RECIBO_APROBACION_APPEND_ONLY/);
 const doc=R.hydrate({...r,_id:new mongoose.Types.ObjectId()});await assert.rejects(doc.save(),/immutable|RECIBO_APROBACION_APPEND_ONLY/);await assert.rejects(doc.save({validateBeforeSave:false}),/RECIBO_APROBACION_APPEND_ONLY/);
});
test("rutas de aprobación y lectura conservan identidad del servidor y errores seguros",async()=>{
 const a=require("../../modules/finanzas-personales/services/aprobacionConversacional.service"),router=require("../../modules/finanzas-personales/routes"),p=router.stack.find(x=>x.route?.path==="/captura/:id/aprobar").route.stack[0].handle,g=router.stack.find(x=>x.route?.path==="/captura/confirmacion-aprobacion/:solicitudId").route.stack[0].handle;
 const res={status(n){this.codigo=n;return this;},json(v){this.value=v;return this;}},aprobar=a.aprobar,consultar=s.consultar;let args;
 try{a.aprobar=async(...v)=>{args=v;return{};};await p({personalAuth:{userId:"propietario"},params:{id:"a".repeat(24)},body:{confirmacion:true,versionBorrador:"c".repeat(64),usuarioId:"ajeno"},get:()=>"aprobacion_prueba"},res);assert.equal(args[0],"propietario");assert.deepEqual(args[3],{confirmacion:true,versionBorrador:"c".repeat(64),solicitudId:"aprobacion_prueba"});
 s.consultar=async(...v)=>{args=v;return{confirmado:true};};await g({personalAuth:{userId:"propietario"},params:{solicitudId:"aprobacion_prueba"},query:{usuarioId:"ajeno"}},res);assert.equal(args[0],"propietario");
 s.consultar=async()=>{throw Error("URI privada");};await g({personalAuth:{userId:"propietario"},params:{solicitudId:"aprobacion_prueba"}},res);assert.equal(res.codigo,500);assert.equal(res.value.error,"No se pudo verificar el recibo de aprobación");
 }finally{a.aprobar=aprobar;s.consultar=consultar;}
});
