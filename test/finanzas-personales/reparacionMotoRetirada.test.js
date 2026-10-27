"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
const mongoose=require("mongoose");
const router=require("../../modules/finanzas-personales/routes");
const {auditarProyecto}=require("../../scripts/gruk-personal-ledger-mutability-audit");

test("reparación de moto devuelve 410 sin iniciar transacciones ni alterar datos",async()=>{
 const layer=router.stack.find(x=>x.route?.path==="/prestamos/reparar-moto");
 assert.ok(layer?.route.methods.post);
 const app=express();
 app.use(express.json());
 app.post(layer.route.path,...layer.route.stack.map(x=>x.handle));
 const anterior=mongoose.startSession;
 let sesiones=0;
 mongoose.startSession=async()=>{sesiones++;throw Error("No se permite modificar el historial");};
 const server=app.listen(0,"127.0.0.1");
 try{
  await new Promise(resolve=>server.once("listening",resolve));
  for(const body of [{},{usuarioId:"ajeno",principalMinor:7000000,saldoMinor:4500000,confirmar:true}]){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/prestamos/reparar-moto`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
   });
   assert.equal(response.status,410);
   const result=await response.json();
   assert.equal(result.ok,false);
   assert.equal(result.codigo,"REPARACION_MOTO_RETIRADA");
   assert.match(result.error,/retirada/);
   assert.equal(result.repaired,undefined);
  }
  assert.equal(sesiones,0);
 }finally{
  mongoose.startSession=anterior;
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});

test("retirar la reparación elimina sus anulaciones pero conserva el bloqueo restante",()=>{
 const pendientes=auditarProyecto();
 const rutas=pendientes.filter(x=>x.archivo==="routes.js");
 assert.equal(rutas.some(x=>["ANULACION_ESTADO","SAVE_ANULACION"].includes(x.id)),false);
 assert.ok(rutas.some(x=>x.id==="MUTACION_MODELO_ORIGINAL"));
 assert.ok(pendientes.some(x=>x.archivo==="services/patrimonioPersonal.service.js"));
});
