"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearEjecutorReparacionReserva}=require(
 "../../modules/finanzas-personales/services/ejecutarReparacionReservaPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",actorId="507f1f77bcf86cd799439015";
const payload={actorId,usuarioId,origenId:"507f1f77bcf86cd799439012",
 reservaId:"507f1f77bcf86cd799439013",huellaEstadoEsperada:"a".repeat(64),
 huellaDiagnostico:"b".repeat(64),idempotencyHash:"c".repeat(64),
 fecha:new Date("2026-10-25T15:00:00Z")};
function infraestructura(){
 const llamadas={indices:0,sesiones:0,queries:0,autorizaciones:[]};
 const sesion={async withTransaction(fn,op){
  assert.equal(op.readConcern.level,"snapshot");
  await fn();
 },async endSession(){}};
 const dependencias={
  EvidenciaModelo:{collection:{async indexes(){llamadas.indices++;
   return [{name:"fp_reconciliacion_reservas_idempotencia_v1",
    unique:true,key:{usuarioId:1,idempotencyHash:1}}];
  }},findOne(){llamadas.queries++;throw Error("NO_DEBE_CONSULTAR");}},
  nuevaSesion:async()=>{llamadas.sesiones++;return sesion;}
 };
 return {llamadas,dependencias};
}
test("el ejecutor carece de permisos por defecto y no puede construirse",()=>{
 assert.throws(()=>crearEjecutorReparacionReserva(),e=>e.statusCode===503);
});
test("actor falso es rechazado antes de índices o transacción",async()=>{
 const {llamadas,dependencias}=infraestructura();
 const ejecutar=crearEjecutorReparacionReserva({...dependencias,
  autorizarActor:async contexto=>{
   llamadas.autorizaciones.push(contexto);
   return false;
  }
 });
 await assert.rejects(()=>ejecutar(payload),e=>e.statusCode===403);
 assert.equal(llamadas.indices,0);
 assert.equal(llamadas.sesiones,0);
 assert.equal(llamadas.queries,0);
 assert.equal(llamadas.autorizaciones[0].accion,"RECONCILIAR_RESERVA_PERSONAL");
 assert.equal(llamadas.autorizaciones[0].actorId,actorId);
});
test("ningún campo del usuario sustituye autorización verdadera estricta",async()=>{
 for(const aceptacion of [undefined,null,1,"true",{autorizado:true}]){
  const {llamadas,dependencias}=infraestructura();
  const ejecutar=crearEjecutorReparacionReserva({...dependencias,
   autorizarActor:async()=>aceptacion
  });
  await assert.rejects(()=>ejecutar(payload),e=>e.statusCode===403);
  assert.equal(llamadas.sesiones,0);
 }
});
test("revocación comprobada dentro de la transacción bloquea toda lectura",async()=>{
 const {llamadas,dependencias}=infraestructura();
 const ejecutar=crearEjecutorReparacionReserva({...dependencias,
  autorizarActor:async contexto=>{
   llamadas.autorizaciones.push(contexto);
   return llamadas.autorizaciones.length===1;
  }
 });
 await assert.rejects(()=>ejecutar(payload),e=>e.statusCode===403);
 assert.equal(llamadas.indices,1);
 assert.equal(llamadas.sesiones,1);
 assert.equal(llamadas.queries,0);
 assert.equal(llamadas.autorizaciones.length,2);
 assert.ok(llamadas.autorizaciones[1].session);
});
test("actorId inválido falla sin consultar autenticación",async()=>{
 const {llamadas,dependencias}=infraestructura();
 const ejecutar=crearEjecutorReparacionReserva({...dependencias,
  autorizarActor:async()=>{throw Error("NO_DEBE_AUTORIZAR");}
 });
 await assert.rejects(()=>ejecutar({...payload,actorId:"admin"}),
  e=>e.statusCode===400);
 assert.equal(llamadas.indices,0);
 assert.equal(llamadas.sesiones,0);
});
