"use strict";
const BASE="gruk_v81_test_browser_personal";
function validarDestinoBrowser(uri,env){
 if(env!=="test")throw Error("Ensayo browser/backend requiere NODE_ENV=test");
 let u;try{u=new URL(uri);}catch{throw Error("Destino de ensayo obligatorio");}
 if(u.protocol!=="mongodb:"||u.hostname!=="127.0.0.1"||u.port!=="27018"||u.pathname!=="/"+BASE||u.username||u.password||u.search||u.hash)throw Error("Ensayo limitado a Mongo local autorizado y base exclusiva");
 return BASE;
}
module.exports={BASE,validarDestinoBrowser};
