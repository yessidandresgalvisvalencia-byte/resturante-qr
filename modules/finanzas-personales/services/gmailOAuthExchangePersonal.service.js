"use strict";
const OAUTH_ENDPOINT="https://oauth2.googleapis.com/token";
function config(){
 const client_id=process.env.PERSONAL_GOOGLE_CLIENT_ID,client_secret=process.env.PERSONAL_GOOGLE_CLIENT_SECRET,redirect_uri=process.env.PERSONAL_GOOGLE_REDIRECT_URI;
 if(!client_id||!client_secret||!redirect_uri||!/^https:\/\//.test(redirect_uri))throw Object.assign(new Error("OAuth Gmail no configurado"),{statusCode:503});
 return{client_id,client_secret,redirect_uri};
}
async function intercambiarCodigo(code,{fetchImpl=fetch}={}){
 if(typeof code!=="string"||!code||code.length>4096)throw Object.assign(new Error("Código OAuth inválido"),{statusCode:400});
 const cfg=config();
 const body=new URLSearchParams({...cfg,code,grant_type:"authorization_code"});
 const res=await fetchImpl(OAUTH_ENDPOINT,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(10000),redirect:"error"});
 if(!res.ok)throw Object.assign(new Error("Google rechazó la autorización"),{statusCode:502});
 const data=await res.json();
 if(typeof data.access_token!=="string"||typeof data.refresh_token!=="string"||!Number.isSafeInteger(data.expires_in)||data.expires_in<=0)throw Object.assign(new Error("Respuesta OAuth incompleta"),{statusCode:502});
 if(data.scope&&!data.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.readonly"))throw Object.assign(new Error("Permisos OAuth inesperados"),{statusCode:502});
 return{access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in};
}
module.exports={intercambiarCodigo,config};
