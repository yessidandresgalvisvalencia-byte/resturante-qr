"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const authMiddleware = require("../../core/auth/auth.middleware");

async function invoke(authorization) {
  const req = { headers: { authorization } };
  const res = { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } };
  let nextCalled=false;
  await authMiddleware(req,res,()=>{nextCalled=true;});
  return {status:res.statusCode,nextCalled};
}
for (const [label,header] of [
  ["array",["Bearer abc","Bearer def"]],
  ["object",{token:"Bearer abc"}],
  ["comma-joined","Bearer abc, Bearer def"],
  ["newline","Bearer abc\nBearer def"],
  ["whitespace","Bearer abc def"],
  ["oversized","Bearer "+"a".repeat(8193)],
  ["lowercase scheme","bearer abc"],
  ["missing",undefined]
]) test("P0-08 rejects malformed authorization header: "+label,async()=>{
  const result=await invoke(header);
  assert.equal(result.status,401);
  assert.equal(result.nextCalled,false);
});
