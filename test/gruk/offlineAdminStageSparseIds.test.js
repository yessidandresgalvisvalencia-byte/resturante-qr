"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateAdminStage,stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
test("Capa 2: stage-orders rechaza IDs dispersos antes de MongoDB",async()=>{
 for(const eventIds of [new Array(1),[id,,id],Array(2),[id,,]]){
  assert.throws(()=>validateAdminStage({auth,eventIds,confirmed:true}),{code:"OFFLINE_INVALID_IDS"});
  let touched=0;
  const db={get client(){touched++;throw Error("UNAUTHORIZED_TRANSACTION");},collection(){touched++;throw Error("UNAUTHORIZED_READ");}};
  await assert.rejects(stageAuthorizedOfflineOrders({db,auth,eventIds,confirmed:true}),{code:"OFFLINE_INVALID_IDS"});
  assert.equal(touched,0);
 }
});
test("Capa 2: stage-orders acepta un ULID propio válido sin abrir la base de datos en validación",()=>{
 assert.deepEqual(validateAdminStage({auth,eventIds:[id],confirmed:true}),
  {empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId});
});
