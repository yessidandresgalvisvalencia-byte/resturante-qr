"use strict";
const SHA=/^[0-9a-f]{40}$/;
function getDeploymentCommit(raw){
 return typeof raw==="string"&&SHA.test(raw)?raw:null;
}
function verifyDeploymentCommit(actual,expected){
 return typeof expected==="string"&&SHA.test(expected)&&getDeploymentCommit(actual)===expected;
}
module.exports={getDeploymentCommit,verifyDeploymentCommit};
