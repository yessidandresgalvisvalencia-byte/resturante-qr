"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {claimsValidas}=require("../../core/auth/jwtClaims.guard");
const {versionCoincide}=require("../../core/auth/tokenVersion.guard");
test("legacy user login issuer includes revocable identity claims",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../../routes/API.js"),"utf8");
 const start=source.indexOf('router.post("/usuarios/login"');
 assert.ok(start>=0);
 const issuer=source.slice(start).match(/jwt\.sign\(\s*\{([\s\S]*?)\},\s*jwtSecret/);
 assert.ok(issuer);
 assert.match(issuer[1],/identityType:\s*"USUARIO"/);
 assert.match(issuer[1],/tokenVersion:\s*Number\(user\.tokenVersion\s*\|\|\s*0\)/);
});
test("issued identity claims are valid and revoked versions fail comparison",()=>{
 const payload={sub:"user1",empresaId:"tenant1",rol:"EMPLEADO",identityType:"USUARIO",tokenVersion:3};
 assert.equal(claimsValidas(payload),true);
 assert.equal(versionCoincide(payload.tokenVersion,3),true);
 assert.equal(versionCoincide(payload.tokenVersion,4),false);
});
