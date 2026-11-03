"use strict";
const mongoose=require("mongoose");
const Legacy=require("../models/inversion.model"),Canonica=require("../models/InversionPatrimonial");
const clases=new Set(["EFECTIVO_RENTABLE","RENTA_FIJA","RENTA_VARIABLE","FONDO","ETF","CRIPTO","INMOBILIARIA","OTRA"]);
const riesgos=new Set(["BAJO","MEDIO","ALTO","NO_CLASIFICADO"]);
const falla=()=>Object.assign(new Error("Inversiones no calculables: revisa moneda, importes e identidad de las fuentes; no se modificó información"),{statusCode:409});
function monto(v){if(!Number.isSafeInteger(v)||v<0)throw falla();return v;}
function sumar(vs){let total=0n;for(const v of vs){if(!Number.isSafeInteger(v))throw falla();total+=BigInt(v);if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))throw falla();}return Number(total);}
function datos(x,usuarioId,legacy){
 if(!x||!mongoose.isValidObjectId(x._id)||String(x[legacy?"userId":"usuarioId"])!==String(usuarioId)||x.moneda!=="COP"||!clases.has(x.clase)||typeof x.nombre!=="string"||!x.nombre.trim()||x.nombre.length>140||/[\u0000-\u001f\u007f]/.test(x.nombre))throw falla();
 if(x.institucion!==undefined&&(typeof x.institucion!=="string"||x.institucion.length>120))throw falla();
 if(x.liquidezDias!==null&&x.liquidezDias!==undefined&&(!Number.isSafeInteger(x.liquidezDias)||x.liquidezDias<0)||!riesgos.has(x.riesgoDeclarado??"NO_CLASIFICADO"))throw falla();
 return{nombre:x.nombre,clase:x.clase,moneda:"COP",capitalAportadoMinor:monto(x[legacy?"capitalAportado":"capitalAportadoMinor"]),valorActualMinor:monto(x[legacy?"valorActual":"valorActualMinor"]),liquidezDias:x.liquidezDias??null,riesgoDeclarado:x.riesgoDeclarado??"NO_CLASIFICADO",institucion:x.institucion??""};
}
function calcular(usuarioId,legacy,canonicas,{retirados=new Set()}={}){
 if(!mongoose.isValidObjectId(usuarioId)||!Array.isArray(legacy)||!Array.isArray(canonicas)||legacy.length>500||canonicas.length>500)throw falla();
 const originales=new Map(),vinculados=new Set(),ids=new Set(),inversiones=[];
 for(const x of legacy){const d=datos(x,usuarioId,true),id=String(x._id);if(originales.has(id))throw falla();originales.set(id,{x,d});}
 const salida=(x,d,fuente,original)=>({...d,id:String(x._id),legacyId:original?String(original._id):null,fuente,solicitudId:x.creacionSolicitudId??null,fechaValorDeclarado:x.fechaValorDeclarado??null,origenValor:x.origenValor??null,fechaRegistro:x.createdAt??null,fechaActualizacionRegistro:x.updatedAt??null,retirada:retirados.has(String(x._id)),valorDeclarado:true,valorMercadoVerificado:false,disponibleEnCaja:false,resultadoDeclaradoMinor:sumar([d.valorActualMinor,-d.capitalAportadoMinor])});
 for(const x of canonicas){const d=datos(x,usuarioId,false),id=String(x._id);if(ids.has(id))throw falla();ids.add(id);
  if(x.legacyId!==null&&x.legacyId!==undefined){const lid=String(x.legacyId),original=originales.get(lid);if(!mongoose.isValidObjectId(x.legacyId)||!original||vinculados.has(lid)||JSON.stringify(d)!==JSON.stringify(original.d))throw falla();vinculados.add(lid);inversiones.push(salida(x,d,"CANONICA_VINCULADA",original.x));}
  else inversiones.push(salida(x,d,"CANONICA",null));
 }
 for(const [id,{x,d}] of originales)if(!vinculados.has(id))inversiones.push(salida(x,d,"ORIGINAL",x));
 inversiones.sort((a,b)=>a.fuente.localeCompare(b.fuente)||a.id.localeCompare(b.id));
 const valorInversionesMinor=sumar(inversiones.filter(x=>!x.retirada).map(x=>x.valorActualMinor)),capitalInvertidoMinor=sumar(inversiones.filter(x=>!x.retirada).map(x=>x.capitalAportadoMinor));
 return{inversiones,valorInversionesMinor,capitalInvertidoMinor,resultadoInversionesMinor:sumar([valorInversionesMinor,-capitalInvertidoMinor]),criterioInversiones:"Valores declarados en COP, sin verificación de mercado. Una copia se excluye solo por legacyId y datos coincidentes. No constituyen caja disponible ni rentabilidad realizada; aportes/retiros y costos requieren su historial."};
}
async function leer(usuarioId,{session}={}){
 if(!session?.inTransaction())throw Object.assign(new Error("La lectura de inversiones requiere una transacción consistente"),{statusCode:503});
 const legacy=await Legacy.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
 const canonicas=await Canonica.find({usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
 const revision=await require("./creacionInversionRecuperablePersonal.service").verificarInversiones(usuarioId,canonicas,{session,legados:legacy});
 return calcular(usuarioId,legacy,canonicas,{retirados:revision.retirados});
}
module.exports={calcular,leer};
