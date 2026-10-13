"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {sellar}=require("../../modules/finanzas-personales/services/gmailConexionPersonal.service");
const {decryptObject}=require("../../modules/finanzas-personales/security/fieldEncryption.service");
test("tokens Gmail cifrados con AAD vinculada al usuario",()=>{
 const old=process.env.PERSONAL_DATA_KEY;
 process.env.PERSONAL_DATA_KEY=crypto.randomBytes(32).toString("base64");
 try{
  const u="507f1f77bcf86cd799439011";
  const sealed=sellar(u,{access_token:"test-access",refresh_token:"test-refresh",expires_in:3600});
  assert.ok(!JSON.stringify(sealed).includes("test-refresh"));
  assert.equal(decryptObject(sealed,{aad:"GMAIL:"+u}).refresh_token,"test-refresh");
  assert.throws(()=>decryptObject(sealed,{aad:"GMAIL:507f1f77bcf86cd799439012"}));
  assert.throws(()=>sellar(u,{access_token:"a",expires_in:3600}),/incompletos/);
 }finally{if(old===undefined)delete process.env.PERSONAL_DATA_KEY;else process.env.PERSONAL_DATA_KEY=old;}
});
