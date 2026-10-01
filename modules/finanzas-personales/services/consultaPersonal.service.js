"use strict";
const service=require("./finanzasPersonales.service");
async function consultar(usuarioId,pregunta){
 const q=String(pregunta||"").trim().toLowerCase();if(!q)throw Object.assign(new Error("Pregunta requerida"),{statusCode:400});
 if(q.includes("patrimonio")){const p=await service.patrimonio(usuarioId);return{tipo:"PATRIMONIO",respuesta:"Patrimonio neto registrado: "+p.patrimonioNeto+".",datos:p};}
 if(q.includes("invert")){const p=await service.planFinanciero(usuarioId);return{tipo:"INVERSION",respuesta:"Capacidad invertible calculada: "+p.capacidadInvertibleAhora+".",datos:p};}
 if(q.includes("deuda")||q.includes("credito")||q.includes("crédito")){const r=await service.resumen(usuarioId);return{tipo:"DEUDA",respuesta:"Deuda registrada: "+r.deudaTotal+". Carga: "+r.cargaDeudaPct+"%.",datos:r};}
 const r=await service.resumen(usuarioId);return{tipo:"RESUMEN",respuesta:"Flujo libre: "+r.flujoLibre+". Ahorro: "+r.tasaAhorroPct+"%. Deuda: "+r.deudaTotal+".",datos:r};
}
module.exports={consultar};