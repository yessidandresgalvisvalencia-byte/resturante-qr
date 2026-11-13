"use strict";
const credito=require("./simulacionCreditoExactaPersonal.service"),{tasa,redondear,cop,fecha}=credito._exacto;
const falla=()=>Object.assign(new RangeError("Simulación requiere precio, cuotas, tasa, método y cargos explícitos"),{statusCode:422});
function simularCuotas(d){
 const campos=["precio","numeroCuotas","tasaPct","metodo","cargosIniciales","fechaDesembolso","fechaPrimerPago"];
 if(!d||typeof d!=="object"||Array.isArray(d)||Object.keys(d).some(k=>!campos.includes(k)))throw falla();
 const {precio,numeroCuotas,metodo,cargosIniciales}=d;
 if(!Number.isSafeInteger(precio)||precio<1||!Number.isSafeInteger(numeroCuotas)||numeroCuotas<1||numeroCuotas>360||!Number.isSafeInteger(cargosIniciales)||cargosIniciales<0||cargosIniciales>=precio||!["SOBRE_CUOTA_BASE","SALDO_DECRECIENTE"].includes(metodo))throw falla();
 const r=tasa(d.tasaPct);let cuotas,total,intereses,tabla=null,calendario=null;
 if(metodo==="SALDO_DECRECIENTE"){
  const c=credito.simular({capital:precio,meses:numeroCuotas,tasaMensualPct:r.texto,cargosIniciales,fechaDesembolso:d.fechaDesembolso,fechaPrimerPago:d.fechaPrimerPago});
  cuotas=c.tabla.map(x=>x.pagoCop);total=c.costoTotal;intereses=c.interesesEstimados;tabla=c.tabla;calendario={fechaDesembolso:c.fechaDesembolso,fechaPrimerPago:c.fechaPrimerPago};
 }else{
  if(d.fechaDesembolso!=null||d.fechaPrimerPago!=null){fecha(d.fechaDesembolso);fecha(d.fechaPrimerPago);if(d.fechaPrimerPago<=d.fechaDesembolso)throw falla();calendario={fechaDesembolso:d.fechaDesembolso,fechaPrimerPago:d.fechaPrimerPago};}
  const p=BigInt(precio)*100n,i=redondear(p*r.n,100000000n),t=p+i,base=t/BigInt(numeroCuotas);
  if(base<1n)throw falla();
  cuotas=Array.from({length:numeroCuotas},(_,n)=>cop(n===numeroCuotas-1?t-base*BigInt(numeroCuotas-1):base));total=cop(t+BigInt(cargosIniciales)*100n);intereses=cop(i);
 }
 return{contrato:2,precioCop:cop(BigInt(precio)*100n),numeroCuotas,tasaPct:r.texto,metodo,cargosInicialesCop:cop(BigInt(cargosIniciales)*100n),cuotas,total,intereses,tabla,calendario,soloSimulacion:true,autorizaCredito:false,creaDeuda:false,cubrePrimeraCuota:null,capacidadMensual:null,costoContractualVerificado:false,redondeo:metodo==="SOBRE_CUOTA_BASE"?"INTERES_UNICO_REDONDEADO_Y_REPARTO_CENTAVOS_ULTIMA_AJUSTADA":"MITAD_HACIA_ARRIBA_POR_PERIODO_A_CENTAVO"};
}
function enteroCop(texto,unidad=""){
 if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+)$/.test(texto))throw falla();
 const n=BigInt(texto.replace(/\./g,""))*(/^mil$|^lucas?$/.test(unidad)?1000n:/^palos?$/.test(unidad)?1000000n:1n);
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw falla();return Number(n);
}
function importeEncontrado(m,t){if(/[\w%]/.test(t.slice(m.index+m[0].length,m.index+m[0].length+1)))throw falla();return enteroCop(m[1].replace(/,$/,""),m[2]);}
function interpretarSimulacion(texto){
 if(typeof texto!=="string"||texto.length>2000)return null;const t=texto.toLowerCase();
 if(!/\b(cuotas|financiar|simular|simula)\b/.test(t))return null;
 const datos={precio:null,numeroCuotas:null,tasaPct:null,metodo:null,cargosIniciales:null},faltantes=[];
 try{
  const precios=[...t.matchAll(/\b(?:valen|cuestan|cuesta|vale|precio(?: de)?|comprar por)\s*\$?\s*(\d[\d.,]*)(?:\s*(mil|lucas?|palos?)\b)?/g)];
  if(precios.length>1)throw falla();if(precios.length)datos.precio=importeEncontrado(precios[0],t);
  const ns=[...t.matchAll(/\b(?:a|en)\s*(\d+|dos|tres|cuatro|seis|doce)\s*cuotas\b/g)],tasas=[...t.matchAll(/(?<![\w.,+\-])(\d+(?:[.,]\d+)?)\s*%/g)];
  if(ns.length>1||tasas.length>1)throw falla();if(ns.length)datos.numeroCuotas=({dos:2,tres:3,cuatro:4,seis:6,doce:12})[ns[0][1]]||Number(ns[0][1]);if(tasas.length)datos.tasaPct=tasa(tasas[0][1].replace(",",".")).texto;
  const unica=/una sola vez sobre (?:(?:el )?(?:precio|capital)|cada cuota base)/.test(t),mensual=/(?:mensual|mensualmente) sobre (?:el )?saldo/.test(t);if(unica&&mensual)throw falla();datos.metodo=unica?"SOBRE_CUOTA_BASE":mensual?"SALDO_DECRECIENTE":null;
  const cargos=[...t.matchAll(/cargos iniciales(?: de)?\s*\$?\s*(\d[\d.,]*)(?:\s*(mil|lucas?|palos?)\b)?/g)],sin=/\bsin (?:otros )?cargos\b/.test(t);if(cargos.length>1||sin&&cargos.length)throw falla();if(sin)datos.cargosIniciales=0;else if(cargos.length)datos.cargosIniciales=importeEncontrado(cargos[0],t);
  for(const [campo,re] of [["fechaDesembolso",/desembolso(?: el)?\s+(\d{4}-\d{2}-\d{2})(?![\w.:-])/g],["fechaPrimerPago",/primer pago(?: el)?\s+(\d{4}-\d{2}-\d{2})(?![\w.:-])/g]]){const xs=[...t.matchAll(re)];if(xs.length>1)throw falla();if(xs.length){fecha(xs[0][1]);datos[campo]=xs[0][1];}}
  for(const k of ["precio","numeroCuotas","tasaPct","metodo","cargosIniciales"])if(datos[k]===null)faltantes.push(k);
  if(datos.metodo==="SALDO_DECRECIENTE")for(const k of ["fechaDesembolso","fechaPrimerPago"])if(!datos[k])faltantes.push(k);
  if(datos.precio!==null&&datos.precio<1||datos.numeroCuotas!==null&&(!Number.isSafeInteger(datos.numeroCuotas)||datos.numeroCuotas<1||datos.numeroCuotas>360))throw falla();
  return{datos,faltantes,estado:faltantes.length?"DATOS_PENDIENTES":"LISTO"};
 }catch{return{datos:null,faltantes:["DATOS_EXPLICITOS_NO_AMBIGUOS"],estado:"REQUIERE_REVISION"};}
}
const dinero=s=>"$"+s.split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g,".")+","+s.split(".")[1];
function responder(texto){
 if(typeof texto!=="string"||!/\b(?:quiero|planeo|pienso|considerando|simula|simular|cu[aá]nto pagar[ií]a)\b/i.test(texto))return null;
 const p=interpretarSimulacion(texto);if(!p)return null;
 const pendiente=(faltantes)=>({clase:"INTENCION",requiereAprobacion:false,mensaje:"🟡 Simulación pendiente; no se ha registrado compra, deuda ni pago.\nFaltan condiciones completas y no ambiguas: "+faltantes.map(k=>({precio:"precio",numeroCuotas:"número de cuotas",tasaPct:"porcentaje",metodo:"método de interés",cargosIniciales:"cargos iniciales",fechaDesembolso:"fecha de desembolso",fechaPrimerPago:"fecha del primer pago",DATOS_EXPLICITOS_NO_AMBIGUOS:"datos sin ambigüedad",ESCENARIO_EXACTO_REPRESENTABLE_Y_CALENDARIO_VALIDO:"escenario y calendario válidos"})[k]||"condiciones verificables").join(", ")+".\nIndica precio, cuotas, porcentaje, método y cargos; para tasa mensual agrega desembolso y primer pago YYYY-MM-DD.\nNo hay capacidad de pago evaluada.",analisis:{soloLectura:true,estado:"DATOS_PENDIENTES",simulacion:null,datosFaltantes:faltantes,autorizaCredito:false}});
 if(p.estado!=="LISTO")return pendiente(p.faltantes);
 try{const c=simularCuotas(p.datos);return{clase:"INTENCION",requiereAprobacion:false,mensaje:"🟡 Escenario de "+c.numeroCuotas+" cuotas; no registra compra ni deuda.\nPrecio "+dinero(c.precioCop)+"; interés "+dinero(c.intereses)+"; cargos iniciales "+dinero(c.cargosInicialesCop)+".\nTotal declarado "+dinero(c.total)+"; primera cuota "+dinero(c.cuotas[0])+"; última "+dinero(c.cuotas.at(-1))+".\nMétodo: "+(c.metodo==="SOBRE_CUOTA_BASE"?"porcentaje único sobre capital, repartido en cuotas":"tasa mensual sobre saldo, cuota fija y última ajustada")+".\nNo verifica costo contractual ni capacidad de pago.\nContrasta estas condiciones con la cotización completa.",analisis:{soloLectura:true,simulacion:c,requiereConfirmarMetodoInteres:false,autorizaCredito:false}};}
 catch{return pendiente(["ESCENARIO_EXACTO_REPRESENTABLE_Y_CALENDARIO_VALIDO"]);}
}
module.exports={simularCuotas,interpretarSimulacion,responder};
