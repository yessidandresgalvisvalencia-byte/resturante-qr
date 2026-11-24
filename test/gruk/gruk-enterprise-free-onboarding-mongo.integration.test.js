"use strict";
// Real disposable MongoDB test; never connects to Atlas or client databases.
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const express=require("express");
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const SuscripcionEmpresa=require("../../models/SuscripcionEmpresa");
const onboarding=require("../../routes/onboarding");
const uri=process.env.TEST_MONGO_URI;
const enabled=uri==="mongodb://127.0.0.1:27017/?replicaSet=rs0";

test("GRUK gratis: registro real -> empresa/sede/usuario -> login JWT -> panel sin suscripción",{
 skip:!enabled&&"Only in GRUK isolated MongoDB replica-set CI",timeout:60000
},async()=>{
 const oldFlag=process.env.GRUK_ENTERPRISE_FREE_ACCESS,oldJwt=process.env.JWT_SECRET;
 process.env.GRUK_ENTERPRISE_FREE_ACCESS="true";
 process.env.JWT_SECRET="GRUK_REAL_ONBOARDING_TEST_SECRET_ONLY";
 const dbName="gruk_gratis_onboard_"+crypto.randomBytes(10).toString("hex");
 let connected=false,server;
 try{
  await mongoose.connect(uri,{dbName,serverSelectionTimeoutMS:10000});connected=true;
  await Promise.all([Empresa.init(),Usuario.init(),Sede.init(),SuscripcionEmpresa.init()]);
  const app=express();app.use(express.json());app.use("/api/onboarding",onboarding);
  server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s))});
  const base="http://127.0.0.1:"+server.address().port;
  const username="grukgratis"+crypto.randomBytes(4).toString("hex");
  const email=username+"@example.com";
  const passwd="password-super-segura-2026";
  const reg=await fetch(base+"/api/onboarding/empresa",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({nombreEmpresa:"GRUK Test Gratis",tipoNegocio:"servicios",correo:email,nombreDueno:"Cliente de prueba",
    usuario:username,password:passwd,nombreSede:"Principal",empleadosActuales:0})});
  const regData=await reg.json();
  assert.equal(reg.status,201,JSON.stringify(regData));
  assert.equal(regData.onboarding.estado,"ACCESO_GRATIS");
  assert.equal(regData.siguientePaso,"INICIAR_SESION");
  assert.equal(regData.gratis,true);
  const empresa=await Empresa.findOne({empresaId:regData.onboarding.empresaId}).lean();
  assert.ok(empresa?._id);
  const sub=await SuscripcionEmpresa.findOne({empresaId:empresa._id}).lean();
  assert.equal(sub?.estado,"ACTIVA");
  assert.equal(sub?.fechaUltimoPago??null,null);
  assert.equal(sub?.fechaProximoCobro??null,null);
  const site=await Sede.findOne({empresaId:empresa._id}).lean();
  assert.equal(String(site?._id),regData.onboarding.sedeId);
  const owner=await Usuario.findOne({usuario:username}).lean();
  assert.equal(String(owner?.empresaId),String(empresa._id));
  assert.ok(owner.password.startsWith("$2"));
  assert.notEqual(owner.password,passwd);
  const login=await fetch(base+"/api/onboarding/login",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({usuario:username,password:passwd})});
  const loginData=await login.json();
  assert.equal(login.status,200,JSON.stringify(loginData));
  assert.equal(loginData.rol,"DUEÑO");
  assert.equal(loginData.gratis,true);
  const me=await fetch(base+"/api/onboarding/me",{headers:{Authorization:"Bearer "+loginData.token}});
  assert.equal(me.status,200);
  assert.equal((await me.json()).usuario,username);
  const paid=await fetch(base+"/api/onboarding/empresa/"+encodeURIComponent(empresa.empresaId)+"/preparar-pago",{method:"POST"});
  assert.equal(paid.status,409);
  assert.equal(await SuscripcionEmpresa.countDocuments({empresaId:empresa._id}),1);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(connected){try{await mongoose.connection.dropDatabase();}finally{await mongoose.disconnect();}}
  if(oldFlag===undefined)delete process.env.GRUK_ENTERPRISE_FREE_ACCESS;else process.env.GRUK_ENTERPRISE_FREE_ACCESS=oldFlag;
  if(oldJwt===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldJwt;
 }
});
