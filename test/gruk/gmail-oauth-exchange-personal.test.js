"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {intercambiarCodigo}=require("../../modules/finanzas-personales/services/gmailOAuthExchangePersonal.service");
test("intercambio OAuth exige respuesta completa y permisos esperados",async()=>{
 const env=["PERSONAL_GOOGLE_CLIENT_ID","PERSONAL_GOOGLE_CLIENT_SECRET","PERSONAL_GOOGLE_REDIRECT_URI"];
 const prev=env.map(k=>process.env[k]);
 process.env.PERSONAL_GOOGLE_CLIENT_ID="client";process.env.PERSONAL_GOOGLE_CLIENT_SECRET="secret";process.env.PERSONAL_GOOGLE_REDIRECT_URI="https://example.com/callback";
 try{
  const fetchImpl=async(url,opts)=>{
   assert.equal(url,"https://oauth2.googleapis.com/token");
   assert.equal(opts.method,"POST");
   assert.equal(opts.body.get("grant_type"),"authorization_code");
   return{ok:true,json:async()=>({access_token:"access",refresh_token:"refresh",expires_in:3600,scope:"https://www.googleapis.com/auth/gmail.readonly"})};
  };
  assert.equal((await intercambiarCodigo("code",{fetchImpl})).refresh_token,"refresh");
  await assert.rejects(()=>intercambiarCodigo("code",{fetchImpl:async()=>({ok:true,json:async()=>({access_token:"access",expires_in:3600})})}),/incompleta/);
  await assert.rejects(()=>intercambiarCodigo("code",{fetchImpl:async()=>({ok:false})}),/rechazó/);
 }finally{env.forEach((k,i)=>prev[i]===undefined?delete process.env[k]:process.env[k]=prev[i]);}
});
