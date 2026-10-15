"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../services/p0/outbox.service.js"), "utf8");
test("ACK de Outbox exige token, propietario y lease no vencido", () => {
  assert.match(source, /const updated=await Outbox\.updateOne\(\{_id:evt\._id,status:'CLAIMED',claimedBy:workerId,claimToken,leaseUntil:\{\$gt:new Date\(\)\}\}/);
});
test("Un trabajador obsoleto no puede reprogramar un evento recuperado", () => {
  assert.match(source, /await Outbox\.updateOne\(\{_id:evt\._id,status:'CLAIMED',claimedBy:workerId,claimToken,leaseUntil:\{\$gt:new Date\(\)\}\},\{\$set:\{status:'PENDING'/);
});
