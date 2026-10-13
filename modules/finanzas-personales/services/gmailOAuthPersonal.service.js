"use strict";
const crypto=require("node:crypto");
function requireSecret(){
 const key=process.env.PERSONAL_GMAIL_OAUTH_STATE_SECRET;
 if(!key||Buffer.byteLength(key,"utf8")<32)throw Object.assign(new Error("OAuth state secret no configurado"),{statusCode:503});
 return key;
}
function crearEstado(usuarioId){
 if(!/^[a-f\d]{24}$/i.test(String(usuarioId)))throw new Error("Usuario inválido");
 const payload={sub:String(usuarioId),nonce:crypto.randomBytes(24).toString("hex"),iat:Date.now()};
 const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
 const mac=crypto.createHmac("sha256",requireSecret()).update(body).digest("base64url");
 return body+"."+mac;
}
function verificarEstado(state){
 if(typeof state!=="string"||state.length>1000)throw new Error("Estado OAuth inválido");
 const partes=state.split(".");if(partes.length!==2)throw new Error("Estado OAuth inválido");
 const [body,mac]=partes;
 const esperado=crypto.createHmac("sha256",requireSecret()).update(body).digest();
 const recibido=Buffer.from(mac,"base64url");
 if(recibido.length!==esperado.length||!crypto.timingSafeEqual(recibido,esperado))throw new Error("Firma OAuth inválida");
 let p;try{p=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));}catch(_){throw new Error("Estado OAuth inválido");}
 if(!p||!/^[a-f\d]{24}$/i.test(p.sub)||typeof p.nonce!=="string"||!Number.isSafeInteger(p.iat)||p.iat>Date.now()+60000||Date.now()-p.iat>600000)throw new Error("Estado OAuth expirado");
 return{usuarioId:p.sub,nonce:p.nonce};
}
function urlAutorizacion({usuarioId,clientId,redirectUri}){
 if(!clientId||!redirectUri||!/^https:\/\//.test(redirectUri))throw new Error("Configuración OAuth inválida");
 const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 for(const [k,v] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"https://www.googleapis.com/auth/gmail.readonly",access_type:"offline",prompt:"consent",include_granted_scopes:"false",state:crearEstado(usuarioId)}))url.searchParams.set(k,v);
 return url.toString();
}
module.exports={crearEstado,verificarEstado,urlAutorizacion};
