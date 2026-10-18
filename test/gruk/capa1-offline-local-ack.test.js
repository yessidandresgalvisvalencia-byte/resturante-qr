"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { synchronize } = require("../../public/js/gruk-offline-transport");
const context = { empresaId:"empresa-A", sedeId:"sede-1", actorId:"operador-1" };
const eventId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const event = { eventId, ...context };
function fixture(markReceived) {
  const state = { calls:0 };
  const outbox = {
    async listPending(limit, actual) {
      assert.deepEqual(actual,context);
      return [event];
    },
    async markReceived(id, actual) {
      assert.equal(id,eventId);
      assert.deepEqual(actual,context);
      state.calls++;
      return markReceived;
    }
  };
  const fetchFn = async (url,options) => {
    assert.equal(url,"/api/sync/batch");
    assert.equal(options.method,"POST");
    assert.deepEqual(JSON.parse(options.body),{events:[event]});
    return { status:202, async json(){ return {ok:true,applied:false,events:[{eventId,status:"RECIBIDO"}]}; } };
  };
  return {outbox,fetchFn,state};
}
test("offline: ACK no persistido no se reporta como recibido",async()=>{
  const {outbox,fetchFn,state}=fixture(false);
  await assert.rejects(
    synchronize({outbox,fetchFn,context,token:"test-token"}),
    /SYNC_LOCAL_ACK_NOT_PERSISTED/
  );
  assert.equal(state.calls,1);
});
test("offline: ACK persistido devuelve recepción sin contabilización financiera",async()=>{
  const {outbox,fetchFn,state}=fixture(true);
  assert.deepEqual(await synchronize({outbox,fetchFn,context,token:"test-token"}),{sent:1,received:1});
  assert.equal(state.calls,1);
});
test("offline: el servidor no puede confirmar evento de otro lote",async()=>{
  const {outbox}=fixture(true);
  await assert.rejects(synchronize({outbox,context,token:"test-token",fetchFn:async()=>({
    status:202,async json(){return {ok:true,applied:false,events:[{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",status:"RECIBIDO"}]};}
  })}),/SYNC_INVALID_ACK/);
});
