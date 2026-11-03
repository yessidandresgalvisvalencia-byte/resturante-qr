"use strict";
const mongoose=require("mongoose");
const tipos=new Set(["EFECTIVO","CUENTA","INMUEBLE","VEHICULO","OTRO"]);
const falla=()=>Object.assign(new Error("Activos no verificables: revisa identidad, importe, moneda y liquidez de las fuentes; no se modificó información"),{statusCode:409});
function sumar(valores){let n=0n;for(const v of valores){if(!Number.isSafeInteger(v)||v<0)throw falla();n+=BigInt(v);}if(n>BigInt(Number.MAX_SAFE_INTEGER))throw falla();return Number(n);}
function datos(x,u,legacy){
 if(!x||!mongoose.isValidObjectId(x._id)||String(x[legacy?"userId":"usuarioId"])!==String(u)||!tipos.has(x.tipo)&&!(legacy&&x.tipo==="INVERSION")||typeof x.nombre!=="string"||!x.nombre.trim()||x.nombre.length>120||/[\u0000-\u001f\u007f]/.test(x.nombre)||typeof x.liquido!=="boolean"||typeof (x.institucion??"")!=="string")throw falla();
 // El contrato de activos legacy no tenía moneda; conserva su unidad COP.
 if(legacy?x.moneda!==undefined&&x.moneda!=="COP":x.moneda!=="COP")throw falla();
 const valor=x[legacy?"valorActual":"valorMinor"];sumar([valor]);
 // Efectivo/cuentas pertenecen a caja, no deben disfrazarse de bienes no líquidos.
 if(["EFECTIVO","CUENTA"].includes(x.tipo)!==x.liquido&&x.tipo!=="INVERSION")throw falla();
 return{nombre:x.nombre,tipo:x.tipo,valorMinor:valor,moneda:"COP",liquido:x.liquido,institucion:x.institucion??""};
}
function calcular(u,legados,activos,{retirados=new Set()}={}){
 if(!mongoose.isValidObjectId(u)||!Array.isArray(legados)||!Array.isArray(activos)||legados.length>500||activos.length>500)throw falla();
 const ls=new Map(),ids=new Set(),vinculados=new Set();
 for(const x of legados){const d=datos(x,u,true),id=String(x._id);if(ls.has(id))throw falla();ls.set(id,{x,d});}
 for(const x of activos){const d=datos(x,u,false),id=String(x._id);if(ids.has(id))throw falla();ids.add(id);if(x.legacyId!==undefined&&x.legacyId!==null){const lid=String(x.legacyId),l=ls.get(lid);if(!mongoose.isValidObjectId(x.legacyId)||!l||vinculados.has(lid)||JSON.stringify(d)!==JSON.stringify(l.d))throw falla();vinculados.add(lid);}}
 return{activosNoLiquidosMinor:sumar(activos.filter(x=>x.liquido===false&&!retirados.has(String(x._id))).map(x=>x.valorMinor)),previos:legados.filter(x=>!vinculados.has(String(x._id))).map(x=>({id:String(x._id),nombre:x.nombre,tipo:x.tipo,fuente:"ORIGINAL_PENDIENTE_DE_REVISION",incluidoEnPatrimonio:false}))};
}
module.exports={sumar,calcular};
