"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {decode,headersMap}=require("../../modules/finanzas-personales/services/gmailSyncPersonal.service");
test("Gmail decode soporta base64url y rechaza payloads excesivos",()=>{
 assert.equal(decode(Buffer.from("Recibiste $20.000").toString("base64url")),"Recibiste $20.000");
 assert.equal(decode("x".repeat(120001)),"");
 assert.deepEqual(headersMap([{name:"From",value:"alerts@example.com"},{name:"Subject",value:"Aviso"}]),{from:"alerts@example.com",subject:"Aviso"});
});
