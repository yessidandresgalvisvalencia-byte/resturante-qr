"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {STATES,assertTransition}=require("../../core/offline/offlineState.contract");
const base={verifiedTenant:{empresaId:"A",sedeId:"1"},recordTenant:{empresaId:"A",sedeId:"1"},authorized:true};
test("offline states: queued operations cannot become applied without domain commit",()=>{
  assert.throws(()=>assertTransition({...base,from:STATES.PENDIENTE,to:STATES.APLICADO,domainCommitted:true}),/OFFLINE_INVALID_TRANSITION/);
  assert.throws(()=>assertTransition({...base,from:STATES.EN_REVISION,to:STATES.APLICADO}),/OFFLINE_DOMAIN_NOT_COMMITTED/);
  assert.equal(assertTransition({...base,from:STATES.EN_REVISION,to:STATES.APLICADO,domainCommitted:true}),true);
});
test("offline states: authorization and tenant checks always required",()=>{
  assert.throws(()=>assertTransition({...base,from:STATES.PENDIENTE,to:STATES.EN_REVISION,authorized:false}),/OFFLINE_PERMISSION_DENIED/);
  assert.throws(()=>assertTransition({...base,recordTenant:{empresaId:"B",sedeId:"1"},from:STATES.PENDIENTE,to:STATES.EN_REVISION}),/OFFLINE_TENANT_MISMATCH/);
});
test("offline states: terminal states cannot reopen",()=>{
  assert.throws(()=>assertTransition({...base,from:STATES.APLICADO,to:STATES.PENDIENTE}),/OFFLINE_INVALID_TRANSITION/);
  assert.throws(()=>assertTransition({...base,from:STATES.RECHAZADO,to:STATES.APLICADO,domainCommitted:true}),/OFFLINE_INVALID_TRANSITION/);
});
