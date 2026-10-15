"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function harness({claim, ackResult, projectionError}) {
  const source = fs.readFileSync(path.join(__dirname, "../../services/p0/outbox.service.js"), "utf8");
  const updates = [];
  let claims = 0;
  const Outbox = {
    async findOneAndUpdate() { return claims++ === 0 ? claim : null; },
    async updateOne(filter, change) {
      updates.push({filter,change});
      return { modifiedCount: ackResult };
    }
  };
  const exports = {};
  const sandbox = {
    module: {exports}, exports,
    require(id) {
      if (id === "crypto") return {randomUUID: () => "token-abc"};
      if (id === "mongoose") return {isValidObjectId: () => true};
      if (id === "../../models/GrukOutbox") return Outbox;
      throw new Error("Unexpected dependency " + id);
    },
    Date, String, Number, Object, Error, Math
  };
  vm.runInNewContext(source, sandbox, {filename:"outbox.service.js"});
  const io = {to() {return {emit(){}};}};
  return {run: () => sandbox.module.exports.publicarLote({
    io, workerId:"worker-old",limit:1,
    proyectarIngreso: async () => {if (projectionError) throw Error("projection failed");}
  }),updates};
}
const event = {
  _id:"evt-1",eventId:"VENTA_COMPLETADA:507f1f77bcf86cd799439011",
  empresaId:"507f191e810c19729de860ea",
  aggregateId:"507f1f77bcf86cd799439011",
  eventName:"VENTA_COMPLETADA",payload:{ventaId:"507f1f77bcf86cd799439011"},
  attempts:1
};
test("Outbox: un ACK fallido no cuenta como entrega", async () => {
  const h=harness({claim:event,ackResult:0});
  const result=await h.run();
  assert.equal(result.sent,0);
  assert.equal(result.failed,1);
  assert.equal(h.updates.length,2);
  for (const update of h.updates) {
    assert.equal(update.filter.claimedBy,"worker-old");
    assert.equal(update.filter.claimToken,"token-abc");
    assert.ok(update.filter.leaseUntil.$gt instanceof Date);
  }
});
test("Outbox: fallo de proyección reprograma sin emitir ACK", async () => {
  const h=harness({claim:event,ackResult:1,projectionError:true});
  const result=await h.run();
  assert.equal(result.sent,0);
  assert.equal(result.failed,1);
  assert.equal(h.updates.length,1);
  assert.equal(h.updates[0].change.$set.status,"PENDING");
});
