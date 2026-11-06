"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {auditarAnclaCompensaciones:auditar}=require("../../modules/finanzas-personales/services/auditoriaAnclaCompensacionesPersonal.service");
const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
const usuarioId="507f1f77bcf86cd799439011";
test("sin identidad, clave pública o custodio no se consulta MongoDB",async()=>{
 assert.equal((await auditar({usuarioId:"otro",clavePublica:publicKey})).codigo,"USUARIO_INVALIDO");
 assert.equal((await auditar({usuarioId,clavePublica:privateKey})).codigo,"CLAVE_PUBLICA_NO_CONFIGURADA");
 assert.equal((await auditar({usuarioId,clavePublica:publicKey})).codigo,"CUSTODIO_EXTERNO_NO_CONFIGURADO");
});
test("fallos y respuestas ausentes del custodio no confirman integridad ni filtran errores",async()=>{
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>{throw Error("secreto-del-proveedor");}}});
 assert.deepEqual(r,{valida:false,codigo:"CUSTODIO_EXTERNO_NO_DISPONIBLE",certificaCustodiaIndependiente:false});
 assert.equal((await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>null}})).codigo,"ANCLA_EXTERNA_NO_DISPONIBLE");
});
test("una referencia disponible no inicia sesión si MongoDB está desconectado",async t=>{
 const mongoose=require("mongoose");assert.equal(mongoose.connection.readyState,0);
 const sesion=t.mock.method(mongoose,"startSession",async()=>{throw Error("NO_DEBE_ESPERAR_CONEXION");});
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>({referencia:"prueba"})}});
 assert.equal(r.codigo,"LECTURA_LEDGER_NO_DISPONIBLE");assert.equal(r.valida,false);
 assert.equal(sesion.mock.callCount(),0);
});
test("un custodio que no responde agota el plazo y recibe cancelación",{timeout:10000},async()=>{
 let signal;
 const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:(_id,opciones)=>{
  signal=opciones.signal;return new Promise(()=>{});
 }}});
 assert.equal(signal.aborted,true);assert.equal(r.codigo,"CUSTODIO_EXTERNO_NO_DISPONIBLE");
 assert.equal(r.valida,false);assert.equal(r.certificaCustodiaIndependiente,false);
});

test("la sesión se cierra ante fallos y un cierre fallido nunca confirma integridad",async t=>{
 const mongoose=require("mongoose");
 const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
 const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
 const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
 const {DOMINIO,payloadAnclaCompensaciones}=require("../../modules/finanzas-personales/security/anclaCompensacionesPersonal.service");
 const evento=eventoCompensatorio({original:{usuarioId,movimientoId:"507f1f77bcf86cd799439012",tipo:"GASTO",
  montoMinor:1000,concepto:"Prueba",categoria:"OTROS"},tipo:"CORRECCION",cambios:{montoMinor:900},
  idempotencyKey:"auditoria-sesion",fechaISO:"2026-10-29T12:00:00.000Z",secuencia:1,prevHash:"0".repeat(64)});
 const cuerpo={version:1,dominio:DOMINIO,algoritmo:"Ed25519",usuarioId,secuencia:1,
  headHash:evento.hashActual,emitidaEn:"2026-10-29T13:00:00.000Z"};
 const ancla={...cuerpo,firma:crypto.sign(null,payloadAnclaCompensaciones(cuerpo),privateKey).toString("base64")};
 const descriptor=Object.getOwnPropertyDescriptor(mongoose.connection,"readyState");
 Object.defineProperty(mongoose.connection,"readyState",{configurable:true,get:()=>1});
 t.after(()=>{if(descriptor)Object.defineProperty(mongoose.connection,"readyState",descriptor);
  else delete mongoose.connection.readyState;});
 for(const caso of ["correcta","apertura","lectura","cierre","lectura-y-cierre"]){
  await t.test(caso,async s=>{
   let cierres=0;
   const session={withTransaction:async fn=>fn(),endSession:async()=>{
    cierres++;if(caso.includes("cierre"))throw Error("secreto-cierre");
   }};
   s.mock.method(mongoose,"startSession",async()=>{if(caso==="apertura")throw Error("secreto-apertura");return session;});
   const consulta=valor=>({sort(){return this;},limit(){return this;},maxTimeMS(){return this;},
    session(actual){assert.equal(actual,session);return this;},async lean(){return valor;}});
   s.mock.method(Evento,"find",()=>{if(caso.includes("lectura"))throw Error("secreto-lectura");return consulta([evento]);});
   s.mock.method(Cursor,"findById",()=>consulta({_id:usuarioId,secuencia:1,hashActual:evento.hashActual}));
   const r=await auditar({usuarioId,clavePublica:publicKey,custodio:{obtenerUltimaAncla:async()=>ancla}});
   assert.equal(cierres,caso==="apertura"?0:1);
   if(caso==="correcta")assert.deepEqual(r,{valida:true,codigo:"ANCLA_VERIFICADA",certificaCustodiaIndependiente:false,secuenciaAnclada:1});
   else assert.deepEqual(r,{valida:false,codigo:"LECTURA_LEDGER_NO_DISPONIBLE",certificaCustodiaIndependiente:false});
  });
 }
});
