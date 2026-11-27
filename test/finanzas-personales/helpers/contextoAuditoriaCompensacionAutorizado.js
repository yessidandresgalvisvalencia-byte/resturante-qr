"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto"),express=require("express"),jwt=require("jsonwebtoken");
const root="../../../modules/finanzas-personales/",A=require(root+"security/contextoAuditoriaCompensacionPersonal.service"),CA=require(root+"security/contextoAuditoriaCuentaPersonal.service"),S=require(root+"services/eventoCompensatorioPersonal.service"),{crearAplicador}=require(root+"services/compensarMovimientoPersonal.service"),F=require(root+"services/flujoCajaPersonal.service"),Alta=require(root+"services/creacionCuentaRecuperablePersonal.service"),C=require(root+"models/cuentaFinanciera.model"),T=require(root+"models/TransaccionPersonal"),E=require(root+"models/EventoCompensatorioPersonal"),Cursor=require(root+"models/CursorCompensacionPersonal"),O=require(root+"models/outboxPersonal.model"),I=require(root+"models/identidadPersonal.model");
async function probarContexto(db){
 const u=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId(),names=["PERSONAL_JWT_SECRET","PERSONAL_AUDIT_CONTEXT_KEY","PERSONAL_AUDIT_CONTEXT_KEY_ID"],prev=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 process.env.PERSONAL_JWT_SECRET=crypto.randomBytes(32).toString("hex");process.env.PERSONAL_AUDIT_CONTEXT_KEY=crypto.randomBytes(32).toString("base64");process.env.PERSONAL_AUDIT_CONTEXT_KEY_ID="compensacion_a";const material=process.env.PERSONAL_AUDIT_CONTEXT_KEY;
 await I.create([u,otro].map(_id=>({_id,email:crypto.randomUUID()+"@example.test",nombre:"Compensación propia",passwordHash:"fixture sin login"})));
 const tokens=[u,otro].map(id=>jwt.sign({scope:"finanzas:personal",tokenVersion:1},process.env.PERSONAL_JWT_SECRET,{subject:String(id),audience:"gruk-finanzas-personales",issuer:"gruk",expiresIn:300})),app=express();app.set("trust proxy",1);app.use(express.json());app.use("/api/finanzas-personales",require(root+"routes"));
 const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));}),url="http://127.0.0.1:"+server.address().port+"/api/finanzas-personales";
 const http=async(path,method,body,key,owner=0)=>{const r=await fetch(url+path,{method,headers:{authorization:"Bearer "+tokens[owner],"content-type":"application/json","user-agent":"Mozilla/5.0 (Android) Chrome/120.0","x-forwarded-for":"203.0.113.88",...(key?{"Idempotency-Key":key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});assert.match(r.headers.get("cache-control")||"",/no-store/);return{status:r.status,body:await r.json()};};
 const foto=async()=>({c:await C.find({usuarioId:u}).sort({_id:1}).lean(),t:await T.find({usuarioId:u}).sort({_id:1}).lean(),e:await E.find({usuarioId:String(u)}).sort({secuencia:1}).lean(),o:await O.find({usuarioId:u}).sort({_id:1}).lean(),cursor:await Cursor.findById(String(u)).lean()});
 try{
  const alta=await Alta.crear(u,"cuenta_"+crypto.randomUUID(),{confirmacion:true,nombre:"Caja compensada",tipo:"EFECTIVO",moneda:"COP",saldoMinor:100000,saldoVerificado:true,fechaSaldo:new Date(Date.now()-180000).toISOString()}),id=String(alta.cuenta._id);
  const registrar=montoMinor=>F.registrarTransaccion(u,{tipo:"GASTO",montoMinor,moneda:"COP",concepto:"Mercado de ensayo",categoria:"Hogar",cuentaId:id,cuenta:"CAJA COMPENSADA",medioPago:"EFECTIVO",fecha:new Date(Date.now()-60000),origen:"MANUAL",externalId:crypto.randomUUID()});
  const tx=await registrar(10000),path="/transacciones/"+tx._id,key="corregir_"+crypto.randomUUID(),cambios={montoMinor:15000},antes=await foto();assert.equal(antes.c[0].saldoMinor,90000);
  delete process.env.PERSONAL_AUDIT_CONTEXT_KEY;
  assert.equal((await http(path,"PATCH",cambios,key)).status,503);assert.deepEqual(await foto(),antes);
  process.env.PERSONAL_AUDIT_CONTEXT_KEY=material;
  assert.equal((await http(path,"PATCH",{...cambios,auditoriaContexto:A.interno(u)},key)).status,400);
  assert.equal((await http(path,"PATCH",cambios,key,1)).status,404);assert.deepEqual(await foto(),antes);
  const carreras=await Promise.all([http(path,"PATCH",cambios,key),http(path,"PATCH",cambios,key)]);for(const r of carreras)assert.equal(r.status,200);
  const uno=await foto(),e=uno.e[0],ctx=e.auditoriaContexto;assert.equal(uno.c[0].saldoMinor,85000);assert.equal(uno.e.length,1);assert.deepEqual(uno.t,antes.t);assert.equal(e.deltaCajaMinor,"-5000");assert.equal(ctx.politica,"FP_COMPENSACION_CAJA_CTX_MIN_V1");
  const req={socket:{remoteAddress:"127.0.0.1"},get:()=>"Mozilla/5.0 (Android) Chrome/120.0"};assert.equal(ctx.red.token,A.capturar(req,u,{ahora:new Date(ctx.capturadoEn)}).red.token);assert.notEqual(ctx.red.token,CA.capturar(req,u,{ahora:new Date(ctx.capturadoEn)}).red.token);
  const visible=carreras[0].body.compensacion;assert.equal(S.hashEvento(visible),e.hashActual);for(const token of [ctx.red.token,"compensacion_a","127.0.0.1","203.0.113.88"])assert.equal(JSON.stringify(visible).includes(token),false);assert.equal(JSON.stringify(uno.o).includes(ctx.red.token),false);
  await registrar(2000);const gastoPosterior=await foto();assert.equal(gastoPosterior.c[0].saldoMinor,83000);delete process.env.PERSONAL_AUDIT_CONTEXT_KEY;assert.equal((await http(path,"PATCH",cambios,key)).status,200);assert.deepEqual(await foto(),gastoPosterior);
  assert.equal((await http(path,"PATCH",{montoMinor:16000},key)).status,409);assert.deepEqual(await foto(),gastoPosterior);
  const anular="anular_"+crypto.randomUUID();assert.equal((await http(path,"DELETE",null,anular)).status,503);assert.deepEqual(await foto(),gastoPosterior);
  process.env.PERSONAL_AUDIT_CONTEXT_KEY=crypto.randomBytes(32).toString("base64");process.env.PERSONAL_AUDIT_CONTEXT_KEY_ID="compensacion_b";
  const anulada=await http(path,"DELETE",null,anular);assert.equal(anulada.status,200);assert.equal((await foto()).c[0].saldoMinor,98000);const anulacionHash=anulada.body.compensacion.hashActual;
  const restaurar="restaurar_"+crypto.randomUUID(),body={confirmar:true,anulacionHash},noRestaurada=await foto();
  assert.equal((await http(path+"/restaurar","POST",{...body,anulacionHash:"f".repeat(64)},restaurar)).status,409);assert.deepEqual(await foto(),noRestaurada);
  const restaurada=await http(path+"/restaurar","POST",body,restaurar);assert.equal(restaurada.status,200);const tres=await foto();assert.equal(tres.c[0].saldoMinor,83000);assert.deepEqual(tres.t,gastoPosterior.t);assert.equal(tres.e.length,3);assert.equal(tres.e[1].auditoriaContexto.red.claveId,"compensacion_b");assert.equal(tres.e[2].anulacionHash,anulacionHash);
  delete process.env.PERSONAL_AUDIT_CONTEXT_KEY;
  for(const [m,b,k,p] of [["PATCH",cambios,key,path],["DELETE",null,anular,path],["POST",body,restaurar,path+"/restaurar"]])assert.equal((await http(p,m,b,k)).status,200);
  assert.deepEqual(await foto(),tres);
  // Insertar evento/cursor y actualizar caja antes de fallar Outbox: todo revierte.
  const aplicar=crearAplicador({OutboxModelo:{create:async()=>{throw Error("FALLO_OUTBOX_ENSAYO");}}});await assert.rejects(aplicar({usuarioId:u,movimientoId:tx._id,tipo:"CORRECCION",cambios:{montoMinor:16000},idempotencyKey:"rollback_"+crypto.randomUUID()}),/FALLO_OUTBOX/);assert.deepEqual(await foto(),tres);
  // Escritura interna explícita sin red, nunca una IP fabricada.
  await crearAplicador()({usuarioId:u,movimientoId:tx._id,tipo:"CORRECCION",cambios:{categoria:"Mercado"},idempotencyKey:"interna_"+crypto.randomUUID()});const interna=await E.findOne({usuarioId:String(u),secuencia:4}).lean();assert.equal(interna.auditoriaContexto.origen,"INTERNO_SIN_RED");assert.equal(interna.auditoriaContexto.red.token,null);assert.equal((await foto()).c[0].saldoMinor,83000);
  // Adulteración administrativa solo en la base sintética: el replay falla cerrado.
  await db.collection(E.collection.collectionName).updateOne({_id:e._id},{$set:{"auditoriaContexto.dispositivo.familia":"ESCRITORIO"}});const alterada=await foto();assert.equal((await http(path,"PATCH",cambios,key)).status,409);assert.deepEqual(await foto(),alterada);
 }finally{for(const n of names){if(prev[n]===undefined)delete process.env[n];else process.env[n]=prev[n];}await new Promise(r=>server.close(r));}
}
module.exports={probarContexto};
