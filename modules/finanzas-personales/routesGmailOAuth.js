"use strict";
const express=require("express");
const auth=require("./security/personalAuth.middleware");
const entitlement=require("./security/entitlement.middleware");
const nonce=require("./services/gmailOAuthNoncePersonal.service");
const exchange=require("./services/gmailOAuthExchangePersonal.service");
const conexion=require("./services/gmailConexionPersonal.service");
const router=express.Router();
router.get("/gmail/iniciar",auth,entitlement,async(req,res)=>{
 try{
  const cfg=exchange.config();
  const url=await nonce.iniciar(req.personalAuth.userId,cfg.client_id,cfg.redirect_uri);
  return res.json({ok:true,url});
 }catch(e){return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:"No fue posible iniciar Gmail"});}
});
router.get("/gmail/callback",async(req,res)=>{
 res.set("Cache-Control","no-store");
 const {code,state,error}=req.query;
 if(error)return res.status(400).type("text/plain").send("Autorización Gmail cancelada");
 if(typeof code!=="string"||typeof state!=="string")return res.status(400).type("text/plain").send("Autorización inválida");
 try{
  const usuarioId=await nonce.consumir(state);
  const tokens=await exchange.intercambiarCodigo(code);
  await conexion.guardarConexion(usuarioId,tokens);
  return res.status(200).type("text/plain").send("Gmail autorizado. Puedes regresar a GRUK.");
 }catch(e){console.error("[GMAIL_OAUTH_CALLBACK]",e.message);return res.status(400).type("text/plain").send("No fue posible conectar Gmail. Vuelve a intentarlo desde GRUK.");}
});
router.post("/gmail/desconectar",auth,entitlement,async(req,res)=>{
 try{return res.json({ok:true,desconectado:await conexion.desconectar(req.personalAuth.userId)});}
 catch(e){console.error("[GMAIL_DISCONNECT]",e.message);return res.status(500).json({ok:false,error:"No fue posible desconectar Gmail"});}
});
module.exports=router;
