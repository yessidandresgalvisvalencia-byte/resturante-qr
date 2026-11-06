"use strict";
// Simulación pura: COP de entrada enteros; todos los cálculos monetarios en centavos BigInt.
const ESCALA=1000000n,DEN=100n*ESCALA;
const falla=()=>Object.assign(new Error("Revisa capital, tasa decimal, plazo, cargos y calendario mensual explícitos"),{statusCode:422});
function redondear(n,d){if(n<0n||d<=0n)throw falla();return n/d+(n%d*2n>=d?1n:0n);}
function cop(n){return(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");}
function fecha(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<"1900-01-01")throw falla();
 const d=new Date(s+"T05:00:00.000Z");if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw falla();return d;
}
function mesDesde(d,n){
 const y=d.getUTCFullYear(),m=d.getUTCMonth()+n,dia=d.getUTCDate();
 const fin=new Date(Date.UTC(y,m+1,0,5)),r=new Date(Date.UTC(y,m,Math.min(dia,fin.getUTCDate()),5));
 if(r.getUTCFullYear()>9999)throw falla();return r.toISOString().slice(0,10);
}
function tasa(valor){
 const s=typeof valor==="number"&&Number.isFinite(valor)?String(valor):valor;
 if(typeof s!=="string"||! /^(0|[1-9]\d{0,2})(\.\d{1,6})?$/.test(s))throw falla();
 const [a,b=""]=s.split("."),n=BigInt(a)*ESCALA+BigInt(b.padEnd(6,"0"));if(n>100n*ESCALA)throw falla();return{n,texto:a+(b?"."+b:"")};
}
function simular(input){
 const campos=["capital","tasaMensualPct","meses","cargosIniciales","fechaDesembolso","fechaPrimerPago"];
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==campos.length||Object.keys(input).some(k=>!campos.includes(k)))throw falla();
 const {capital,meses,cargosIniciales}=input;
 if(!Number.isSafeInteger(capital)||capital<1||!Number.isSafeInteger(cargosIniciales)||cargosIniciales<0||cargosIniciales>=capital||!Number.isSafeInteger(meses)||meses<1||meses>600)throw falla();
 const r=tasa(input.tasaMensualPct),desembolso=fecha(input.fechaDesembolso);fecha(input.fechaPrimerPago);
 if(mesDesde(desembolso,1)!==input.fechaPrimerPago)throw falla();
 mesDesde(desembolso,meses); // Capacidad del calendario antes de construir el resultado.
 const principal=BigInt(capital)*100n,cargos=BigInt(cargosIniciales)*100n;
 const a=(DEN+r.n)**BigInt(meses),b=DEN**BigInt(meses);
 const cuota=r.n===0n?redondear(principal,BigInt(meses)):redondear(principal*r.n*a,DEN*(a-b));
 if(cuota<1n)throw falla();
 let saldo=principal,intereses=0n,total=0n;const tabla=[];
 for(let i=1;i<=meses;i++){
  const interes=redondear(saldo*r.n,DEN),pago=i===meses?saldo+interes:cuota;
  // Un plazo que no se puede representar con centavos no se cambia silenciosamente.
  if(pago<=interes||(i<meses&&pago>=saldo+interes))throw falla();
  const amortizacion=pago-interes,anterior=saldo;saldo-=amortizacion;intereses+=interes;total+=pago;
  tabla.push({numero:i,fecha:mesDesde(desembolso,i),saldoInicialCop:cop(anterior),interesCop:cop(interes),capitalCop:cop(amortizacion),pagoCop:cop(pago),saldoFinalCop:cop(saldo)});
 }
 if(saldo!==0n||total!==principal+intereses)throw falla();
 const ea=redondear(((DEN+r.n)**12n-DEN**12n)*100n*ESCALA,DEN**12n);
 return{contrato:2,moneda:"COP",unidadCalculo:"CENTAVO_COP",capitalCop:cop(principal),desembolsoNetoCop:cop(principal-cargos),cargosInicialesCop:cop(cargos),cuotaMensual:cop(cuota),ultimaCuotaCop:tabla.at(-1).pagoCop,costoTotal:cop(total+cargos),totalCuotasCop:cop(total),interesesEstimados:cop(intereses),tasaMensualPct:r.texto,tasaEfectivaAnualPct:(ea/ESCALA).toString()+"."+(ea%ESCALA).toString().padStart(6,"0"),meses,fechaDesembolso:input.fechaDesembolso,fechaPrimerPago:input.fechaPrimerPago,tabla,redondeo:"MITAD_HACIA_ARRIBA_POR_PERIODO_A_CENTAVO",metodo:"CUOTA_FIJA_MENSUAL_ULTIMA_AJUSTADA",autorizaCredito:false,creaDeuda:false,costoContractualVerificado:false,limites:"Escenario de tasa mensual constante; cargos declarados pagados al inicio, no financiados. No verifica seguros, impuestos, cotización contractual ni capacidad de pago. Sin prorrateo diario."};
}
function crearHandler(calcular=simular){return(req,res)=>{
 res.set("Cache-Control","private, no-store");if(!req.personalAuth?.userId)return res.status(401).json({ok:false,error:"Sesión personal requerida"});
 try{return res.json({ok:true,simulacion:calcular(req.body)});}catch(e){return res.status(e.statusCode===422?422:503).json({ok:false,codigo:"SIMULACION_NO_VERIFICABLE",error:e.statusCode===422?"Revisa capital entero COP, tasa de hasta seis decimales, cargos iniciales explícitos y fechas mensuales válidas.":"No fue posible completar la simulación."});}
};}
module.exports={simular,crearHandler,_exacto:{tasa,redondear,cop,fecha}};
