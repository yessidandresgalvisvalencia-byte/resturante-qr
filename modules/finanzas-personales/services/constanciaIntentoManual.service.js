"use strict";
const crypto=require("node:crypto"),shared=require("../../../public/finanzas-personales-constancia");
const DOMAIN="GRUK_FP_CONSTANCIA_MANUAL_V1:",sha=x=>crypto.createHash("sha256").update(shared.canon(x)).digest("hex");
function crear({usuarioId,input,fuente,actual,estado,secret=process.env.PERSONAL_IDEMPOTENCY_SECRET}){
 if(typeof secret!=="string"||secret.length<32)throw Object.assign(Error("Constancia no disponible"),{statusCode:503});
 const u=String(usuarioId),id=String(fuente?._id||"");if(!/^[a-f0-9]{24}$/.test(u)||!/^[a-f0-9]{24}$/.test(id)||String(fuente?.usuarioId)!==u||String(actual?._id)!==id||String(actual?.usuarioId)!==u)throw Object.assign(Error("Fuente no verificable"),{statusCode:409});
 if(actual.estado!==(estado==="ANULADA"?"ANULADA":"ACTIVA"))throw Object.assign(Error("Proyección no verificable"),{statusCode:409});
 const solicitud=shared.cuerpo(input),original=Object.fromEntries(shared.campos.map(k=>[k,k==="externalId"?input.externalId:fuente[k]])),p={version:"FP_CONSTANCIA_MANUAL_V1",usuarioId:u,transaccionId:id,externalId:input.externalId,ruta:"/transacciones/constancia-intento",metodo:"POST",estado,proyeccionEstado:actual.estado,estadoOriginal:fuente.estado,compensacionHash:actual.compensacionHash||null,solicitudHuella:sha({usuarioId:u,cuerpo:solicitud}),fuenteHash:sha({usuarioId:u,transaccionId:id,estado:fuente.estado,cuerpo:shared.cuerpo(original)}),soloLectura:true,afectaCaja:false,autorizaGasto:false,certificaEstadoActual:false,alcance:"FUENTE_ORIGINAL_Y_PROYECCION_EN_SNAPSHOT"};
 const hash=sha(p),firma=crypto.createHmac("sha256",secret).update(DOMAIN+hash).digest("hex"),r={...p,hash,firma};if(!shared.estructura(r))throw Object.assign(Error("Estado de fuente no verificable"),{statusCode:409});return r;
}
function verificarFirma(r,secret=process.env.PERSONAL_IDEMPOTENCY_SECRET){if(!shared.estructura(r)||typeof secret!=="string"||secret.length<32||sha(shared.payload(r))!==r.hash)return false;const expected=crypto.createHmac("sha256",secret).update(DOMAIN+r.hash).digest();return crypto.timingSafeEqual(expected,Buffer.from(r.firma,"hex"));}
module.exports={crear,verificarFirma};
