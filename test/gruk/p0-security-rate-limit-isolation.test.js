"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const rateLimit=require("../../core/security/rateLimit.middleware");

function request(limiter,ip){
 const result={status:200,headers:{},next:false};
 const res={
  setHeader(k,v){result.headers[k]=v;},
  status(code){result.status=code;return this;},
  json(body){result.body=body;return this;}
 };
 limiter({ip},res,()=>{result.next=true;});
 return result;
}
test("separate limiter instances never share counters",()=>{
 const first=rateLimit({max:1}),second=rateLimit({max:1});
 assert.equal(request(first,"tenant-proxy").status,200);
 assert.equal(request(first,"tenant-proxy").status,429);
 assert.equal(request(second,"tenant-proxy").status,200);
 assert.equal(request(second,"tenant-proxy").status,429);
});
test("IP counters are independent and blocked requests carry Retry-After",()=>{
 const limiter=rateLimit({max:1,windowMs:60000});
 assert.equal(request(limiter,"ip-a").status,200);
 assert.equal(request(limiter,"ip-b").status,200);
 const blocked=request(limiter,"ip-a");
 assert.equal(blocked.status,429);
 assert.equal(blocked.headers["Retry-After"],"60");
 assert.equal(blocked.next,false);
});
test("invalid rate-limit configuration fails closed",()=>{
 for(const options of [{max:0},{max:-1},{max:1.2},{windowMs:0},{windowMs:Infinity}]){
  assert.throws(()=>rateLimit(options),/RATE_LIMIT_CONFIG_INVALID/);
 }
});
test("window expiry restores quota",()=>{
 const original=Date.now;
 let now=1000;
 Date.now=()=>now;
 try{
  const limiter=rateLimit({max:1,windowMs:1000});
  assert.equal(request(limiter,"ip").status,200);
  assert.equal(request(limiter,"ip").status,429);
  now=2000;
  assert.equal(request(limiter,"ip").status,200);
 }finally{Date.now=original;}
});

test("bounded IP capacity rejects new identities without evicting live quotas",()=>{
 const limiter=rateLimit({max:1,windowMs:60000});
 for(let i=0;i<10000;i++)assert.equal(request(limiter,"ip-"+i).status,200);
 const overflow=request(limiter,"overflow");
 assert.equal(overflow.status,429);
 assert.equal(overflow.headers["Retry-After"],"60");
 assert.equal(overflow.next,false);
 assert.equal(request(limiter,"ip-0").status,429);
});

test("expired IP capacity is reclaimed without rejecting a new identity",()=>{
 const original=Date.now;
 let now=1000;
 Date.now=()=>now;
 try{
  const limiter=rateLimit({max:1,windowMs:1000});
  for(let i=0;i<10000;i++)assert.equal(request(limiter,"ip-"+i).status,200);
  assert.equal(request(limiter,"new").status,429);
  now=2000;
  assert.equal(request(limiter,"new").status,200);
  assert.equal(request(limiter,"ip-0").status,200);
 }finally{Date.now=original;}
});
