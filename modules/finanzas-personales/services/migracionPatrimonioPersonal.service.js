"use strict";
const mongoose=require("mongoose");
const Activo=require("../models/activo.model"),Inversion=require("../models/inversion.model"),Credito=require("../models/credito.model"),Perfil=require("../models/perfil.model");
const ActivoNuevo=require("../models/ActivoPatrimonial"),InversionNueva=require("../models/InversionPatrimonial"),Deuda=require("../models/DeudaPersonal"),PerfilNuevo=require("../models/UsuarioPatrimonio");
const falla=m=>Object.assign(new Error(m),{statusCode:409});
function minor(v){if(!Number.isSafeInteger(v)||v<0)throw falla("Monto histórico no exacto; requiere revisión sin redondear ni convertir");return v;}
function sumar(vs){let n=0n;for(const v of vs)n+=BigInt(minor(v));if(n>BigInt(Number.MAX_SAFE_INTEGER))throw falla("Total histórico fuera del rango exacto");return Number(n);}
function identidad(u){if(!mongoose.isValidObjectId(u))throw Object.assign(new Error("Usuario patrimonial inválido"),{statusCode:400});return new mongoose.Types.ObjectId(String(u));}
function cop(v){if(v!=="COP")throw falla("Moneda histórica no verificable como COP; no se convierte");return v;}
function base(x,u){return{usuarioId:u,legacyId:x._id,nombre:x.nombre,institucion:x.institucion??""};}
function planificar(usuarioId,fuentes){
 const u=identidad(usuarioId),planes={activos:[],inversiones:[],deudas:[],perfiles:[]};
 for(const [grupo,rows] of Object.entries(fuentes)){
  if(!Array.isArray(rows)||rows.length>(grupo==="perfiles"?1:500))throw falla("Capacidad de revisión patrimonial excedida");
  const ids=new Set();for(const x of rows){if(!x||!mongoose.isValidObjectId(x._id)||String(x.userId)!==String(u)||ids.has(String(x._id)))throw falla("Identidad histórica duplicada o de otro usuario");ids.add(String(x._id));}
 }
 // Activos legacy no tenían campo moneda: se conserva la unidad COP del contrato
 // original; una moneda explícita distinta nunca se convierte silenciosamente.
 for(const x of fuentes.activos){if(x.moneda!==undefined)cop(x.moneda);if(x.tipo==="INVERSION")throw falla("Activo histórico clasificado como inversión requiere revisión de identidad antes de migrar");planes.activos.push({...base(x,u),tipo:x.tipo,valorMinor:minor(x.valorActual),moneda:"COP",liquido:x.liquido});}
 for(const x of fuentes.inversiones)planes.inversiones.push({...base(x,u),clase:x.clase,capitalAportadoMinor:minor(x.capitalAportado),valorActualMinor:minor(x.valorActual),moneda:cop(x.moneda),liquidezDias:x.liquidezDias??null,riesgoDeclarado:x.riesgoDeclarado??"NO_CLASIFICADO"});
 for(const x of fuentes.deudas){if(x.moneda!==undefined)cop(x.moneda);planes.deudas.push({usuarioId:u,legacyId:x._id,nombre:x.nombre,saldoMinor:minor(x.saldo),cuotaMensualMinor:minor(x.cuotaMensual),tasaMensualPct:x.tasaMensualPct,mesesRestantes:x.mesesRestantes,moneda:"COP",activa:x.activo});}
 for(const x of fuentes.perfiles)planes.perfiles.push({usuarioId:u,monedaBase:cop(x.moneda),fondoEmergenciaObjetivoMeses:x.fondoEmergenciaObjetivoMeses,ahorroObjetivoPct:x.ahorroObjetivoPct,saldoLiquidoMinor:minor(x.saldoLiquido),versionPolitica:2});
 for(const [g,campo] of [["activos","valorMinor"],["inversiones","valorActualMinor"],["inversiones","capitalAportadoMinor"],["deudas","saldoMinor"],["deudas","cuotaMensualMinor"]])sumar(planes[g].map(x=>x[campo]));
 return planes;
}
const canon=v=>v instanceof mongoose.Types.ObjectId?String(v):v instanceof Date?v.toISOString():v;
function corresponde(actual,esperado){return Object.entries(esperado).every(([k,v])=>canon(actual[k])===canon(v));}
function evaluar(planes,destinos){
 const faltantes={},conteos={legacy:{},nuevo:{}},totales={legacy:{},nuevo:{}};let ok=true;
 for(const grupo of Object.keys(planes)){
  const rows=destinos[grupo];if(!Array.isArray(rows)||rows.length>(grupo==="perfiles"?1:500))throw falla("Capacidad de revisión de copias excedida");
  const mapa=new Map();for(const x of rows){const k=grupo==="perfiles"?String(x.usuarioId):String(x.legacyId);if(mapa.has(k))throw falla("Copias históricas duplicadas");mapa.set(k,x);}
  faltantes[grupo]=[];for(const esperado of planes[grupo]){const k=grupo==="perfiles"?String(esperado.usuarioId):String(esperado.legacyId),actual=mapa.get(k);if(!actual){faltantes[grupo].push(esperado);ok=false;}else if(!corresponde(actual,esperado))throw falla("Copia patrimonial discrepante; no se reescribe la fuente ni la copia");mapa.delete(k);}
  if(mapa.size)throw falla("Copia patrimonial sin fuente original propia verificable");
  if(grupo!=="perfiles"){conteos.legacy[grupo]=planes[grupo].length;conteos.nuevo[grupo]=rows.length;const campo={activos:"valorMinor",inversiones:"valorActualMinor",deudas:"saldoMinor"}[grupo];totales.legacy[grupo]=sumar(planes[grupo].map(x=>x[campo]));totales.nuevo[grupo]=sumar(rows.map(x=>x[campo]));}
 }
 return{ok,faltantes,conteos,totales,dobleConteoInversionEliminado:true};
}
const grupos={activos:[Activo,ActivoNuevo],inversiones:[Inversion,InversionNueva],deudas:[Credito,Deuda],perfiles:[Perfil,PerfilNuevo]};
async function leer(u,s){const fuentes={},destinos={};for(const [g,[L,C]] of Object.entries(grupos)){fuentes[g]=await L.find({userId:u}).limit(g==="perfiles"?2:501).maxTimeMS(5000).session(s).lean();destinos[g]=await C.find(g==="perfiles"?{usuarioId:u}:{usuarioId:u,legacyId:{$ne:null}}).limit(g==="perfiles"?2:501).maxTimeMS(5000).session(s).lean();}return{fuentes,destinos};}
async function ejecutar(usuarioId,escribir){
 const u=identidad(usuarioId),s=await mongoose.startSession();let salida;
 try{await s.withTransaction(async()=>{
  if(escribir)await require("./proteccionOriginalCompensadoPersonal.service").serializarEscrituraFuente(u,s);
  const {fuentes,destinos}=await leer(u,s);
  const activos=await ActivoNuevo.find({usuarioId:u}).limit(501).maxTimeMS(5000).session(s).lean();await require("./creacionActivoRecuperablePersonal.service").verificarActivos(u,activos,{session:s,legados:fuentes.activos});
  const inversiones=await InversionNueva.find({usuarioId:u}).limit(501).maxTimeMS(5000).session(s).lean();await require("./creacionInversionRecuperablePersonal.service").verificarInversiones(u,inversiones,{session:s,legados:fuentes.inversiones});
  const planes=planificar(u,fuentes),revision=evaluar(planes,destinos);
  // Validación completa antes del primer INSERT; Mongoose no debe corregir tipos
  // financieros por casting. Las cantidades se verificaron sin coerción arriba.
  for(const [g,rows] of Object.entries(planes))for(const row of rows){const documento=new grupos[g][1](row);await documento.validate();if(!corresponde(documento.toObject(),row))throw falla("La copia exigiría convertir datos históricos; requiere revisión explícita");}
  if(escribir){for(const [g,rows] of Object.entries(revision.faltantes))for(const row of rows){if((g==="activos"||g==="inversiones")&&fuentes[g].find(x=>String(x._id)===String(row.legacyId))?.creacionSolicitudId!==undefined)throw falla("Declaración protegida sin copia; requiere recuperación explícita");await grupos[g][1].create([row],{session:s});}await require("./creacionActivoRecuperablePersonal.service").verificarActivos(u,await ActivoNuevo.find({usuarioId:u}).limit(501).maxTimeMS(5000).session(s).lean(),{session:s});const final=evaluar(planes,(await leer(u,s)).destinos);if(!final.ok)throw falla("Migración sin conciliación completa");salida=final;}else salida=revision;
  delete salida.faltantes;
 },{readConcern:{level:"snapshot"},writeConcern:escribir?{w:"majority"}:undefined,readPreference:"primary"});return salida;
 }finally{await s.endSession();}
}
module.exports={minor,sumar,planificar,evaluar,migrar:u=>ejecutar(u,true),reconciliar:u=>ejecutar(u,false)};
