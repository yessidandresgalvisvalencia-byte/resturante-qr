"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearEstado,verificarEstado,urlAutorizacion}=require("../../modules/finanzas-personales/services/gmailOAuthPersonal.service");
test("OAuth Gmail firma estado, verifica integridad y usa alcance de solo lectura",()=>{
 const prev=process.env.PERSONAL_GMAIL_OAUTH_STATE_SECRET;
 process.env.PERSONAL_GMAIL_OAUTH_STATE_SECRET="test-secret-not-for-production-123456789";
 try{
  const uid="507f1f77bcf86cd799439011";
  const state=crearEstado(uid);
  assert.equal(verificarEstado(state).usuarioId,uid);
  assert.throws(()=>verificarEstado(state.slice(0,-1)+"!"));
  const u=new URL(urlAutorizacion({usuarioId:uid,clientId:"client.apps.googleusercontent.com",redirectUri:"https://example.com/oauth/callback"}));
  assert.equal(u.searchParams.get("scope"),"https://www.googleapis.com/auth/gmail.readonly");
  assert.equal(u.searchParams.get("response_type"),"code");
  assert.equal(u.searchParams.get("state")!==null,true);
 }finally{if(prev===undefined)delete process.env.PERSONAL_GMAIL_OAUTH_STATE_SECRET;else process.env.PERSONAL_GMAIL_OAUTH_STATE_SECRET=prev;}
});
