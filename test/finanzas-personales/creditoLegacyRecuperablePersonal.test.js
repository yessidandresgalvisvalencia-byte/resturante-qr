"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose");
const s=require("../../modules/finanzas-personales/services/creditoLegacyRecuperablePersonal.service"),E=require("../../modules/finanzas-personales/models/retiroCreditoLegacyPersonal.model");
function fixture(tipo="RETIRO"){
 const p={_id:new mongoose.Types.ObjectId(),userId:new mongoose.Types.ObjectId(),nombre:"Ensayo",saldo:1200,cuotaMensual:300,tasaMensualPct:1.5,mesesRestantes:4,activo:true};
 const anterior=s.foto(p),posterior={...anterior,activo:false},e={usuarioId:p.userId,creditoId:p._id,secuencia:1,solicitudId:"operacion_01",tipo,referencia:null,prestamoIncorporadoId:tipo==="INCORPORACION"?new mongoose.Types.ObjectId():null,anterior,posterior,fecha:new Date(),hashAnterior:"0".repeat(64)};e.hashActual=s.hash(e);
 return{p:{...p,activo:false,retiroRevision:1,retiroHash:e.hashActual},e};
}
test("ciclo legacy verifica retiro y restauración, rechaza alteraciones y no restaura incorporaciones",()=>{
 for(const tipo of ["RETIRO","INCORPORACION"]){
  const {p,e}=fixture(tipo);assert.equal(s.verificar([e],p),e);assert.throws(()=>s.verificar([] ,p),/no verificable/);
  assert.throws(()=>s.verificar([{...e,anterior:{...e.anterior,saldo:1}}],p),/no verificable/);
  const r={...e,secuencia:2,solicitudId:"recuperar_01",tipo:"RESTAURACION",referencia:e.hashActual,prestamoIncorporadoId:null,anterior:e.posterior,posterior:e.anterior,hashAnterior:e.hashActual};r.hashActual=s.hash(r);
  if(tipo==="RETIRO")assert.equal(s.verificar([e,r],{...p,retiroRevision:2,retiroHash:r.hashActual}),r);
  else assert.throws(()=>s.verificar([e,r],{...p,retiroRevision:2,retiroHash:r.hashActual}),/no verificable/);
 }
});
test("índice legacy debe abarcar todos los estados y no tener sparse, TTL ni collation insegura",()=>{
 const i={key:{usuarioId:1,legacyCreditoId:1},unique:true,partialFilterExpression:{legacyCreditoId:{$type:"objectId"}}};assert.equal(s.indiceLegacyValido([i]),true);
 for(const patch of [{unique:false},{sparse:true},{expireAfterSeconds:1},{collation:{locale:"es"}},{partialFilterExpression:{legacyCreditoId:{$type:"objectId"},estado:"ACTIVO"}}])assert.equal(s.indiceLegacyValido([{...i,...patch}]),false);
});
test("evidencia legacy rechaza mutación y confirmación ausente antes de MongoDB",async()=>{
 for(const op of [()=>E.updateOne({},{$set:{tipo:"RETIRO"}}),()=>E.deleteMany({}),()=>E.bulkWrite([])])await assert.rejects(op(),/CREDITO_LEGACY_APPEND_ONLY/);
 const doc=E.hydrate({...fixture().e,_id:new mongoose.Types.ObjectId()});await assert.rejects(doc.save(),/CREDITO_LEGACY_APPEND_ONLY/);
 await assert.rejects(s.incorporar(new mongoose.Types.ObjectId(),new mongoose.Types.ObjectId(),{}),e=>e.statusCode===400);
});
test("rutas legacy usan identidad autenticada, conservan referencias y ocultan errores internos",async()=>{
 const router=require("../../modules/finanzas-personales/routes");
 for(const [metodo,ruta,accion] of [["post","/creditos/:id/incorporar-a-deudas","incorporar"],["delete","/creditos/:id","retirar"],["post","/creditos/:id/restaurar-retiro","restaurar"]]){
  const handler=router.stack.find(x=>x.route?.path===ruta&&x.route.methods[metodo]).route.stack[0].handle,original=s[accion];let args;
  const res={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.value=v;return this;}};
  try{s[accion]=async(...a)=>{args=a;return{vigente:true};};const req={personalAuth:{userId:"propietario"},params:{id:"credito"},body:{usuarioId:"ajeno",confirmacion:true,retiroHash:"a".repeat(64)}};await handler(req,res);assert.equal(args[0],"propietario");assert.equal(args[1],"credito");assert.equal(args[2].retiroHash,req.body.retiroHash);
   s[accion]=async()=>{throw Error("dato interno");};await handler(req,res);assert.equal(res.statusCode,500);assert.equal(res.value.error,"No fue posible confirmar la operación del crédito");
  }finally{s[accion]=original;}
 }
});
