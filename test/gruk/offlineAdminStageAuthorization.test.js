"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateAdminStage,stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"administrator",rol:"ADMIN_SEDE"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
test("admin staging: owner/admin must explicitly confirm and use own authenticated scope",()=>{
 for(const rol of ["EMPLEADO",undefined,"ADMIN","cajero"]){
  assert.throws(()=>validateAdminStage({auth:{...auth,rol},eventIds:[eventId],confirmed:true}),
   e=>e.code==="OFFLINE_STAGE_PERMISSION_DENIED");
 }
 assert.throws(()=>validateAdminStage({auth,eventIds:[eventId],confirmed:false}),
  /OFFLINE_STAGE_CONFIRMATION_REQUIRED/);
 const scope=validateAdminStage({auth,eventIds:[eventId],confirmed:true});
 assert.deepEqual(scope,{empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId});
 assert.equal(validateAdminStage({auth:{...auth,rol:"DUEÑO"},eventIds:[eventId],confirmed:true}).actorId,auth.usuarioId);
});
test("admin staging: ULID, tenant mappings and duplicates must validate before touching Mongo",async()=>{
 for(const ids of [[eventId,eventId],["bad"],[],[1]]){
  await assert.rejects(stageAuthorizedOfflineOrders({db:{},auth,eventIds:ids,confirmed:true}),
   /OFFLINE_INVALID_IDS/);
 }
 await assert.rejects(stageAuthorizedOfflineOrders({db:{},auth:{...auth,empresaId:"bad"},eventIds:[eventId],confirmed:true}),
  /OFFLINE_STAGE_IDENTITY_NOT_MAPPED/);
 await assert.rejects(stageAuthorizedOfflineOrders({db:{},auth,eventIds:[eventId],confirmed:true}),
  /OFFLINE_TRANSACTION_UNAVAILABLE/);
});
