"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {securityHeaders}=require("../../core/security/httpSecurity.middleware");
function apply(value){
 const headers={};let nextCalls=0;
 securityHeaders({headers:{"x-request-id":value}},{setHeader(name,v){headers[name]=v;}},()=>{nextCalls++;});
 assert.equal(nextCalls,1);
 assert.equal(headers["X-Content-Type-Options"],"nosniff");
 return headers["X-Request-Id"];
}
test("preserves bounded safe tracing IDs",()=>{
 assert.equal(apply("edge-abc_123:trace.9"),"edge-abc_123:trace.9");
});
test("rejects header injection, arrays, oversized and non-string IDs",()=>{
 for(const value of ["bad\r\nX-Injected: yes"," space", "x".repeat(65),["first","second"],42,{},null,""]){
  const id=apply(value);
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.notEqual(id,value);
 }
});
test("generates request ID when missing",()=>{
 assert.match(apply(undefined),/^[0-9a-f-]{36}$/i);
});
