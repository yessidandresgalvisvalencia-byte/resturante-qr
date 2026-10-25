"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateAdminStage}=require("../../core/offline/offlineAdminStage.service");
const original={empresaId:"507f191e810c19729de860ea",
 sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:"ADMIN_SEDE"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
test("Capa 2: auth con getters no permite aprobación sin validar identidad",()=>{
 for(const field of ["empresaId","sedeId","usuarioId","rol"]){
  let called=0;
  const auth={...original};
  Object.defineProperty(auth,field,{enumerable:true,configurable:true,
   get(){called++;return original[field];}});
  assert.throws(()=>validateAdminStage({auth,eventIds:[eventId],confirmed:true}),
   {code:"OFFLINE_STAGE_PERMISSION_DENIED"});
  assert.equal(called,0,field);
 }
});
test("Capa 2: IDs dispersos y con getters nunca se aprueban",()=>{
 const arrays=[new Array(1),[eventId,,],[]];
 for(const eventIds of arrays)
  assert.throws(()=>validateAdminStage({auth:original,eventIds,confirmed:true}),
   {code:"OFFLINE_INVALID_IDS"});
 const ids=[eventId];let called=0;
 Object.defineProperty(ids,0,{enumerable:true,configurable:true,
  get(){called++;return eventId;}});
 assert.throws(()=>validateAdminStage({auth:original,eventIds:ids,confirmed:true}),
  {code:"OFFLINE_INVALID_IDS"});
 assert.equal(called,0);
});
test("Capa 2: validación propia conserva empresa, sede y actor",()=>{
 const context=validateAdminStage({auth:original,eventIds:[eventId],confirmed:true});
 assert.deepEqual(context,{empresaId:original.empresaId,sedeId:original.sedeId,
  actorId:original.usuarioId});
 assert.equal(Object.isFrozen(context),true);
});
test("Capa 2: posting y su respuesta mantienen scope e IDs aunque cambien durante acceso DB",async()=>{
 const dependencies=[
  ["offlineInventoryStagingTransaction.service","executeOfflineInventoryStagingTransaction"],
  ["offlineOversellAudit.service","recordOfflineOversellConflict"],
  ["offlineStageRecovery.service","recoverOfflineStagedBatch"]
 ];
 const paths=dependencies.map(([file])=>require.resolve("../../core/offline/"+file));
 const initial=paths.map(p=>require.cache[p].exports);
 const stagePath=require.resolve("../../core/offline/offlineAdminStage.service");
 const previous=require.cache[stagePath];
 const auth={...original},ids=[eventId];
 let executions=0;
 try{
  for(let i=0;i<paths.length;i++){
   const name=dependencies[i][1];
   require.cache[paths[i]].exports={...initial[i],[name]:async args=>{
    if(i!==0)throw Error("UNEXPECTED_RECOVERY_OR_AUDIT");
    executions++;
    assert.deepEqual(args.context,{empresaId:original.empresaId,
     sedeId:original.sedeId,actorId:original.usuarioId});
    assert.deepEqual(args.eventIds,[eventId]);
    assert(Object.isFrozen(args.context));
    assert(Object.isFrozen(args.eventIds));
    return {status:"PENDIENTE_CONTABILIZACION",inventory:[{productoId:"prod"}],
     inventoryApplied:true,sales:{totalCop:"3000"}};
   }};
  }
  delete require.cache[stagePath];
  const {stageAuthorizedOfflineOrders}=require(stagePath);
  const db={client:{get startSession(){
   Object.assign(auth,{empresaId:"507f191e810c19729de860eb",
    sedeId:"507f1f77bcf86cd799439013",rol:"EMPLEADO",usuarioId:"intruso"});
   ids[0]="01ARZ3NDEKTSV4RRFFQ69G5FA1";
   return ()=>{};
  }}};
  const result=await stageAuthorizedOfflineOrders({db,auth,eventIds:ids,confirmed:true});
  assert.equal(executions,1);
  assert.equal(result.processedEvents,1);
  assert.equal(result.totalCop,"3000");
  assert.equal(result.applied,false);
  assert.equal(result.cobrado,false);
 }finally{
  paths.forEach((p,i)=>require.cache[p].exports=initial[i]);
  if(previous)require.cache[stagePath]=previous;
  else delete require.cache[stagePath];
 }
});
