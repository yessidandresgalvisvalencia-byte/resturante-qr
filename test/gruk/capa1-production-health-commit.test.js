"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {getDeploymentCommit,verifyDeploymentCommit}=require("../../core/health/deploymentCommit.contract");
const a="a".repeat(40),b="b".repeat(40);
test("render health: exact deployed SHA is required",()=>{
 assert.equal(getDeploymentCommit(a),a);
 assert.equal(verifyDeploymentCommit(a,a),true);
 assert.equal(verifyDeploymentCommit(a,b),false);
});
test("render health: missing or malformed SHAs cannot be accepted",()=>{
 for(const value of [undefined,null,"","1.0.0","abcd","g".repeat(40),"A".repeat(40),"a".repeat(41)]){
  assert.equal(getDeploymentCommit(value),null);
  assert.equal(verifyDeploymentCommit(value,a),false);
  assert.equal(verifyDeploymentCommit(a,value),false);
 }
});
