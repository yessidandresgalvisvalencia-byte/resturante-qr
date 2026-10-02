"use strict";
const Borrador=require("../models/borradorFinanciero.model");
const hoy=()=>new Date();
function monto(s){const raw=String(s).toLowerCase().trim(),unit=raw.match(/\b(mil|k|mill[oó]n(?:es)?)\b/i)?.[1]||"";let n;const num=raw.match(/(?:\$\s*)?(\d+(?:[.,]\d+)?)/);if(!num)return null;if(/mill/i.test(unit)){n=Number(num[1].replace(",","."))*1000000}else if(/mil|k/i.test(unit)){n=Number(num[1].replace(",","."))*1000}else{const digits=num[1].replace(/[^0-9]/g,"");n=Number(digits)}n=Math.round(n);return Number.isSafeInteger(n)&&n>0?n:null}
function categoria(t,tipo){if(/arriendo|alquiler/i.test(t))return"Vivienda";if(/mercado|comida|almuerzo|desayuno|cena/i.test(t))return"Alimentación";if(/uber|taxi|bus|gasolina|transporte/i.test(t))return"Transporte";if(/salario|sueldo|n[oó]mina/i.test(t))return"Salario";if(/tarjeta|cr[eé]dito|cuota|deuda/i.test(t))return"Deuda";if(/prest/i.test(t))return"Préstamo";return tipo==="INGRESO"?"Otros ingresos":"Otros gastos"}
function numeroPalabras(s){const t=String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g," ");const nums={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,veinte:20,treinta:30,cuarenta:40,cincuenta:50,cien:100,quinientos:500};let total=0,current=0,seen=false;for(const w of t.split(/\s+/)){if(/^\d+(?:[.,]\d+)?$/.test(w)){current+=Number(w.replace(",","."));seen=true;continue}if(nums[w]!=null){current+=nums[w];seen=true;continue}if(w==="mil"){current=(current||1)*1000;seen=true;continue}if(w==="millon"||w==="millones"){total+=(current||1)*1000000;current=0;seen=true;continue}}return seen?Math.round(total+current):null}
function valorDespues(t,re){const m=t.match(re);if(!m)return null;const frag=m[1].trim();const limpio=frag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");const abreviado=limpio.match(/^(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\s+millones?\s+(\d+|cien|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos)(?!\s+mil)/);if(abreviado){const base=/^\d+$/.test(abreviado[1])?Number(abreviado[1]):numeroPalabras(abreviado[1]);const resto=/^\d+$/.test(abreviado[2])?Number(abreviado[2]):numeroPalabras(abreviado[2]);if(base&&resto!=null)return base*1000000+resto*1000}const numeric=monto(frag);if(numeric&&numeric>31)return numeric;return numeroPalabras(frag)}
function deudaEstructurada(t){
  if(!/(?:deuda|financ|credito|cr[eé]dito|moto|carro|veh[ií]culo|pr[eé]stamo)/i.test(t))return null;
  const texto=String(t).replace(/\s+/g," ").trim();
  const dm=texto.match(/(?:cada|el)\s+(?:d[ií]a\s+)?(\d{1,2})\s+(?:de\s+)?cada\s+mes|(?:cada|el)\s+d[ií]a\s+(\d{1,2})/i);
  const dia=dm?Number(dm[1]||dm[2]):null;
  const buscar=res=>{for(const re of res){const v=valorDespues(texto,re);if(v!=null)return v}return null};
  const principal=buscar([
    /(?:me\s+cost[oó]|cost[oó]|valor\s+(?:original|total)(?:\s+de)?|precio(?:\s+de)?|por\s+un\s+valor\s+de)\s*([^,;.]+?)(?=\s+(?:y|sin|con|cada|pago|cuota|pero)|[,;.]|$)/i,
    /(?:moto|carro|veh[ií]culo|deuda|credito|cr[eé]dito|pr[eé]stamo)\s+(?:de|por)\s*([^,;.]+?)(?=\s+(?:y|sin|con|cada|pago|cuota|pero)|[,;.]|$)/i
  ]);
  const abono=buscar([/(?:ya\s+)?(?:he|hab[ií]a)?\s*(?:abonado|abon[eé]|pagado|pagu[eé])\s*([^,;.]+?)(?=\s+(?:y|sin|con|cada|pero)|[,;.]|$)/i]);
  const cuota=buscar([
    /(?:cuota(?:\s+(?:mensual|de))?|pago\s+mensual|me\s+toca\s+pagar)\s*(?:de\s*)?([^,;.]+?)(?=\s+(?:y|sin|con|cada|el\s+d[ií]a|pero)|[,;.]|$)/i,
    /(?:cada|el)\s+(?:d[ií]a\s+)?\d{1,2}\s+(?:de\s+)?cada\s+mes\s*[,;:]?\s*([^,;.]+?)(?=\s+(?:y|sin|con|pero)|[,;.]|$)/i
  ]);
  if(!principal||!cuota||!dia||dia<1||dia>31)return null;
  const abonado=abono||0,saldo=principal-abonado;
  if(saldo<0||cuota>principal)return null;
  const concepto=/moto/i.test(texto)?"Moto":/carro|veh[ií]culo/i.test(texto)?"Vehículo":"Deuda";
  return{tipo:"DEUDA_POR_PAGAR",montoMinor:principal,principalMinor:principal,saldoMinor:saldo,abonadoMinor:abonado,cuotaMinor:cuota,diaPago:dia,frecuencia:"MENSUAL",concepto,categoria:"Deuda",contraparte:"",fecha:hoy(),estado:"LISTO",confianza:99,razonRevision:"",tasaMensualPct:/sin\s+inter[eé]s/i.test(texto)?0:undefined};
}
function interpretarSegmento(raw){const deuda=deudaEstructurada(raw);if(deuda)return deuda;const t=raw.trim();if(!t)return null;const m=monto(t);let tipo=null,concepto=t.slice(0,140),conf=90,razon="";if(/me deben|quedaron (?:en |de )?pagarme|me lo pagan despu[eé]s|por cobrar/i.test(t))tipo="CUENTA_POR_COBRAR";else if(/le prest[eé]|prest[eé].*(?:a |al )/i.test(t))tipo="PRESTAMO_OTORGADO";else if(/me prestaron|ped[ií] prestado/i.test(t))tipo="PRESTAMO_RECIBIDO";else if(/me devolvi[oó]|me pag[oó].*prest|cobr[eé].*prest/i.test(t))tipo="COBRO_PRESTAMO";else if(/pagu[eé].*(?:deuda|tarjeta|cr[eé]dito|cuota)/i.test(t))tipo="PAGO_DEUDA";else if(/gast[eé]|compr[eé]|pagu[eé]|me cost[oó]|egreso/i.test(t))tipo="GASTO";else if(/gan[eé]|recib[ií]|me pagaron|ingres[oó]|vend[ií]/i.test(t))tipo="INGRESO";if(!m){conf=30;razon="No pude determinar un monto confiable."}if(!tipo){conf=Math.min(conf,40);razon=razon||"No pude determinar la naturaleza financiera."}return{tipo:tipo||"GASTO",montoMinor:m||1,concepto,categoria:categoria(t,tipo),contraparte:"",fecha:hoy(),estado:conf>=80?"LISTO":"REQUIERE_REVISION",confianza:conf,razonRevision:razon}}
async function crearBorrador(usuarioId,{texto,canal="TEXTO"}){const partes=String(texto).split(/\n+|;|\s+y\s+(?=(?:hoy|ayer|tambi[eé]n|despu[eé]s|luego|gast[eé]|gan[eé]|recib[ií]|pagu[eé]|compr[eé]|prest[eé]))/i).map(x=>x.trim()).filter(Boolean);const items=partes.map(interpretarSegmento).filter(Boolean);if(!items.length)throw Object.assign(new Error("No detecté hechos financieros"),{statusCode:422});return Borrador.create({usuarioId,canal,textoOriginal:texto,items})}
module.exports={crearBorrador,interpretarSegmento,deudaEstructurada};