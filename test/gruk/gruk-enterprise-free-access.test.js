"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const express=require("express");
const bcrypt=require("bcrypt");
const Usuario=require("../../models/usuario");
const Empresa=require("../../models/Empresa");
const onboarding=require("../../routes/onboarding");
const {accesoEmpresarialGratis,suspenderCobroSuscripcion}=require("../../core/comercial/grukFreeAccess.service");
const {validarVersionSesion}=require("../../core/auth/sessionVersion.service");
const fromRoot=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
const oldEnv=()=>({GRUK_ENTERPRISE_FREE_ACCESS:process.env.GRUK_ENTERPRISE_FREE_ACCESS,JWT_SECRET:process.env.JWT_SECRET});
const restore=(values)=>{for(const [k,v] of Object.entries(values)){if(v===undefined)delete process.env[k];else process.env[k]=v;}};

test("free phase is explicit, reversible and limited to enterprise subscriptions",()=>{
 const backup=oldEnv();
 try{
  delete process.env.GRUK_ENTERPRISE_FREE_ACCESS;
  assert.equal(accesoEmpresarialGratis(),false,"fail closed unless explicitly activated on Render");
  process.env.GRUK_ENTERPRISE_FREE_ACCESS="true";
  assert.equal(accesoEmpresarialGratis(),true);
  let status,body;
  const res={status(x){status=x;return this},json(x){body=x;return this}};
  let nextCalls=0;
  suspenderCobroSuscripcion({},res,()=>nextCalls++);
  assert.equal(status,409);
  assert.equal(body.code,"GRUK_EMPRESARIAL_GRATIS");
  assert.equal(nextCalls,0);
  process.env.GRUK_ENTERPRISE_FREE_ACCESS="false";
  suspenderCobroSuscripcion({},res,()=>nextCalls++);
  assert.equal(nextCalls,1);
 }finally{restore(backup);}
});

test("free registration flow never collects card data and disables legacy payment pages",()=>{
 const html=fromRoot("public/registro-empresa.html");
 assert.match(html,/Crear cuenta gratis/);
 assert.match(html,/login-empresa\.html/);
 assert.doesNotMatch(html,/location\.assign\("\/pago-empresa\.html/);
 const app=fromRoot("app.js");
 assert.match(app,/registro-restaurante\.html/);
 assert.match(app,/pago-empresa\.html/);
 assert.match(app,/pago-suscripcion\.html/);
 const billing=fromRoot("routes/API.js");
 assert.match(billing,/crear-pago-suscripcion", suspenderCobroSuscripcion/);
 assert.match(billing,/suscripciones\/cobrar", authMiddleware, roleCheck\(ROLES_GRUK.DUENO\), suspenderCobroSuscripcion/);
 assert.match(billing,/registro-y-fuente-pago", suspenderCobroSuscripcion/);
 const job=fromRoot("jobs/suscripciones.js");
 assert.match(job,/if \(accesoEmpresarialGratis\(\)\) return;/);
 assert.match(fromRoot("routes/onboarding.js"),/preparar-pago",suspenderCobroSuscripcion/);
});

test("enterprise owner: bcrypt login, tenant-scoped JWT, /me and invalid password",async()=>{
 const backup=oldEnv(),originals={findOne:Usuario.findOne,findById:Usuario.findById,companyFind:Empresa.findById};
 process.env.GRUK_ENTERPRISE_FREE_ACCESS="true";
 process.env.JWT_SECRET="GRUK_FREE_LOGIN_TEST_SECRET_ONLY_SUPPLIED_LOCALLY";
 const enterprise="222222222222222222222222",site="333333333333333333333333",subject="111111111111111111111111";
 const storedHash=await bcrypt.hash("contraseña-segura-de-prueba-123",12);
 const identity={_id:subject,empresaId:enterprise,sedeId:site,restauranteId:null,
  rol:"admin_general",estado:"activo",usuario:"dueño-prueba",nombre:"Dueño de prueba",password:storedHash,tokenVersion:0};
 Usuario.findOne=(query)=>({
  select:()=>({lean:async()=>query._id?{...identity,password:undefined}:{...identity},
   then(resolve,reject){return Promise.resolve(identity).then(resolve,reject)}})
 });
 Usuario.findById=()=>({select:()=>({lean:async()=>({tokenVersion:0})})});
 Empresa.findById=()=>({select:()=>({lean:async()=>({_id:enterprise,estado:"activa"})})});
 const app=express();app.use(express.json());app.use("/api/onboarding",onboarding);
 const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s))});
 const base="http://127.0.0.1:"+server.address().port;
 try{
  const bad=await fetch(base+"/api/onboarding/login",{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({usuario:"dueño-prueba",password:"contraseña-incorrecta"})});
  assert.equal(bad.status,401);
  const unauth=await fetch(base+"/api/onboarding/me");
  assert.equal(unauth.status,401);
  const login=await fetch(base+"/api/onboarding/login",{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({usuario:"dueño-prueba",password:"contraseña-segura-de-prueba-123"})});
  assert.equal(login.status,200);
  const result=await login.json();
  assert.equal(result.rol,"DUEÑO");
  assert.equal(result.empresaId,enterprise);
  assert.equal(result.sedeId,site);
  assert.equal(result.gratis,true);
  assert.ok(result.token);
  const me=await fetch(base+"/api/onboarding/me",{headers:{Authorization:"Bearer "+result.token}});
  assert.equal(me.status,200);
  const profile=await me.json();
  assert.equal(profile.empresaId,enterprise);
  assert.equal(profile.sedeId,site);
  assert.equal(profile.usuario,"dueño-prueba");
  assert.equal(await validarVersionSesion({identityType:"USUARIO",sub:subject,tokenVersion:1}),false);
  assert.equal(await validarVersionSesion({identityType:"USUARIO",sub:subject,tokenVersion:0}),true);
  const checkout=await fetch(base+"/api/onboarding/empresa/emp_test/preparar-pago",{method:"POST"});
  assert.equal(checkout.status,409);
  assert.equal((await checkout.json()).code,"GRUK_EMPRESARIAL_GRATIS");
 }finally{
  await new Promise(resolve=>server.close(resolve));
  Usuario.findOne=originals.findOne;Usuario.findById=originals.findById;Empresa.findById=originals.companyFind;
  restore(backup);
 }
});
