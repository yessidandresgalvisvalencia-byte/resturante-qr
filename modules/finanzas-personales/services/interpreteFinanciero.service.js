"use strict";
const Borrador=require("../models/borradorFinanciero.model");
const colombia=require("./colombiaFinanciero.service");
const hoy=()=>colombia.fechaColombia(0);
function monto(s){const raw=String(s).toLowerCase().trim();if(/\b(?:m[aá]s o menos|aprox(?:imadamente)?|por ah[ií]|como unos?|como unas?)\b/i.test(raw))return null;if(/\bmedio\s+(?:palo|barra)\b/i.test(raw))return 500000;const m=raw.match(/(?:\$\s*)?(\d+(?:[.,]\d+)?)\s*(mill[oó]n(?:es)?|lucas?|palos?|barras?|mil|m|k)?\b/i);if(!m)return null;const unit=(m[2]||"").toLowerCase();let parts;if(/^(?:luca|mil|k)/i.test(unit)&&/^\d{1,3}[.,]\d{3}$/.test(m[1]))parts=[m[1].replace(/[.,]/g,"")];else parts=m[1].split(/[.,]/);let factor=1;if(/luca|mil|^k$/.test(unit))factor=1000;else if(/palo|barra|^m$|mill/.test(unit))factor=1000000;if(factor===1){const digits=m[1].replace(/\D/g,"");const n=Number(digits);return Number.isSafeInteger(n)&&n>0?n:null;}let entero=BigInt(parts[0]),valor=entero*BigInt(factor);if(parts[1]){const scale=10n**BigInt(parts[1].length);valor+=(BigInt(parts[1])*BigInt(factor))/scale;}if(valor<=0n||valor>BigInt(Number.MAX_SAFE_INTEGER))return null;return Number(valor)}
function categoria(t,tipo){if(/ahorr|guardar plata/i.test(t))return"Ahorro";if(/prest/i.test(t)&&!/gota a gota/i.test(t))return"Préstamo";return colombia.clasificar(t,tipo)}
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
  if(!principal||!dia||dia<1||dia>31)return null;
  const abonado=abono||0,saldo=principal-abonado;
  if(saldo<0||(cuota!=null&&cuota>principal))return null;
  const concepto=/moto/i.test(texto)?"Moto":/carro|veh[ií]culo/i.test(texto)?"Vehículo":"Deuda";
  return{tipo:"DEUDA_POR_PAGAR",montoMinor:principal,principalMinor:principal,saldoMinor:saldo,abonadoMinor:abonado,cuotaMinor:cuota||0,diaPago:dia,frecuencia:"MENSUAL",concepto,categoria:"Deuda",contraparte:"",fecha:hoy(),estado:"LISTO",confianza:99,razonRevision:"",tasaMensualPct:/sin\s+inter[eé]s/i.test(texto)?0:undefined};
}
function cobroCuenta(t){const texto=String(t).replace(/\s+/g," ").trim();const m=texto.match(/^([\p{L}ÁÉÍÓÚÑáéíóúñ]+)(?:\s+[\p{L}ÁÉÍÓÚÑáéíóúñ]+)?\s+me\s+(?:pag[oó]|consign[oó]|transfiri[oó])/iu);if(!m)return null;const v=monto(texto);if(!v)return null;return{tipo:"COBRO_CUENTA_POR_COBRAR",montoMinor:v,concepto:"Cobro recibido",categoria:"Cuenta por cobrar",contraparte:m[1],fecha:hoy(),estado:"LISTO",confianza:98,razonRevision:""};}
function cuentaPorCobrar(t){
 const texto=String(t).replace(/\s+/g," ").trim();
 if(!/\b(?:me debe|me deben|me qued[oó] debiendo|me va a pagar|me van a pagar|por cobrar)\b/i.test(texto))return null;
 const m=monto(texto);if(!m)return null;
 let contraparte="Por identificar";
 const p=texto.match(/^(?:a\s+)?([A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+)(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+)?\s+me\s+debe/iu)||texto.match(/\b([A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+)\s+me\s+debe/iu);
 if(p)contraparte=p[1];
 const dm=texto.match(/(?:me\s+paga|me\s+pagan|paga|pagan)(?:\s+el)?\s+(?:d[ií]a\s+)?(\d{1,2})/i);
 const dia=dm?Number(dm[1]):null;let fechaVencimiento;
 if(dia&&dia>=1&&dia<=31){const b=hoy();let y=b.getFullYear(),mo=b.getMonth();if(b.getDate()>dia){mo++;if(mo>11){mo=0;y++;}}fechaVencimiento=new Date(y,mo,Math.min(dia,new Date(y,mo+1,0).getDate()),12,0,0,0);}
 return{tipo:"CUENTA_POR_COBRAR",montoMinor:m,concepto:"Dinero por cobrar",categoria:"Cuenta por cobrar",contraparte,fecha:hoy(),fechaVencimiento,estado:"LISTO",confianza:95,razonRevision:""};
}
function interpretarSegmento(raw){const cobrado=cobroCuenta(raw);if(cobrado)return cobrado;const deuda=deudaEstructurada(raw);if(deuda)return deuda;const cobrar=cuentaPorCobrar(raw);if(cobrar)return cobrar;const t=raw.trim();if(!t)return null;const m=monto(t);const montoSinUnidad=/(?:^|\s)(?:\$\s*)?\d{1,3}(?:\s|$)/.test(t)&&!/\$|cop|pesos?|lucas?|palos?|barras?|mill[oó]n|millones|\bmil\b|\bk\b|\bm\b/i.test(t);let tipo=null,concepto=t.slice(0,140),conf=90,razon="";if(montoSinUnidad){conf=30;razon="El monto es ambiguo en Colombia: confirma si son pesos, miles/lucas o millones."}if(/me deben|quedaron (?:en |de )?pagarme|me lo pagan despu[eé]s|por cobrar/i.test(t))tipo="CUENTA_POR_COBRAR";else if(/le prest[eé]|prest[eé].*(?:a |al )/i.test(t))tipo="PRESTAMO_OTORGADO";else if(/me prestaron|ped[ií] prestado/i.test(t))tipo="PRESTAMO_RECIBIDO";else if(/me devolvi[oó]|me pag[oó].*prest|cobr[eé].*prest/i.test(t))tipo="COBRO_PRESTAMO";else if(/pagu[eé].*(?:deuda|tarjeta|cr[eé]dito|cuota)/i.test(t))tipo="PAGO_DEUDA";else if(/gast[eé]|compr[eé]|pagu[eé]|me cost[oó]|egreso/i.test(t))tipo="GASTO";else if(/gan[eé]|recib[ií]|me pagaron|ingres[oó]|vend[ií]/i.test(t))tipo="INGRESO";if(!m){conf=30;razon=razon||"No pude determinar un monto confiable."}if(!tipo){conf=Math.min(conf,40);razon=razon||"No pude determinar la naturaleza financiera."}return{tipo:tipo||"GASTO",montoMinor:m||0,concepto,categoria:categoria(t,tipo),contraparte:"",fecha:(/\b(?:ayer|anoche)\b/i.test(t)?colombia.fechaColombia(-1):hoy()),estado:conf>=80?"LISTO":"REQUIERE_REVISION",confianza:conf,razonRevision:razon}}
async function crearBorrador(usuarioId,{texto,canal="TEXTO"}){const partes=String(texto).split(/\n+|;|\s+y\s+(?=(?:hoy|ayer|tambi[eé]n|despu[eé]s|luego|gast[eé]|gan[eé]|recib[ií]|pagu[eé]|compr[eé]|prest[eé]))/i).map(x=>x.trim()).filter(Boolean);const items=partes.map(interpretarSegmento).filter(Boolean);if(!items.length)throw Object.assign(new Error("No detecté hechos financieros"),{statusCode:422});return Borrador.create({usuarioId,canal,textoOriginal:texto,items})}
module.exports={crearBorrador,interpretarSegmento,deudaEstructurada,cuentaPorCobrar,cobroCuenta,parseMontoExacto:monto};