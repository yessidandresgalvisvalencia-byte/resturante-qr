"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),S=require("../../modules/finanzas-personales/services/simulacionCreditoExactaPersonal.service");
const datos=(d={})=>({capital:1000,tasaMensualPct:"10",meses:2,cargosIniciales:5,fechaDesembolso:"2026-01-31",fechaPrimerPago:"2026-02-28",...d});
const cent=s=>BigInt(s.replace(".",""));
test("vector de dos cuotas: capital, interés y cargos separados, fechas y EA explícitas",()=>{
 const d=datos(),r=S.simular(d);assert.deepEqual(d,datos());assert.equal(r.cuotaMensual,"576.19");assert.equal(r.costoTotal,"1157.38");assert.equal(r.interesesEstimados,"152.38");assert.equal(r.desembolsoNetoCop,"995.00");assert.equal(r.tasaEfectivaAnualPct,"213.842838");assert.deepEqual(r.tabla.map(x=>x.fecha),["2026-02-28","2026-03-31"]);
 assert.deepEqual(r.tabla.map(x=>[x.interesCop,x.capitalCop,x.saldoFinalCop]),[["100.00","476.19","523.81"],["52.38","523.81","0.00"]]);assert.equal(r.autorizaCredito,false);assert.equal(r.creaDeuda,false);assert.equal(r.costoContractualVerificado,false);assert.equal(require("../../modules/finanzas-personales/services/finanzasPersonales.service").simularCredito(datos()).costoTotal,r.costoTotal);
});
test("tasa cero conserva centavos y ajusta última cuota, calendario bisiesto y cambio de año",()=>{
 const r=S.simular(datos({capital:1,tasaMensualPct:"0",meses:3,cargosIniciales:0}));assert.deepEqual(r.tabla.map(x=>x.pagoCop),["0.33","0.33","0.34"]);assert.equal(r.costoTotal,"1.00");assert.equal(r.interesesEstimados,"0.00");assert.equal(r.tasaEfectivaAnualPct,"0.000000");
 const b=S.simular(datos({fechaDesembolso:"2023-12-31",fechaPrimerPago:"2024-01-31",meses:3}));assert.deepEqual(b.tabla.map(x=>x.fecha),["2024-01-31","2024-02-29","2024-03-31"]);
});
test("moneda nunca pierde precisión aun por encima del rango Number de centavos/totales",()=>{
 const r=S.simular(datos({capital:Number.MAX_SAFE_INTEGER,meses:12,tasaMensualPct:"1",cargosIniciales:0}));assert.equal(r.capitalCop,"9007199254740991.00");assert.ok(cent(r.costoTotal)>BigInt(Number.MAX_SAFE_INTEGER));assert.equal(r.tabla.at(-1).saldoFinalCop,"0.00");
});
test("matriz determinística reconcilia todos los saldos, capital, interés y pagos",()=>{
 for(const tasaMensualPct of ["0","0.000001","0.125000",2.5])for(const meses of [1,2,12,120,600]){
  if(tasaMensualPct===2.5&&meses===600){assert.throws(()=>S.simular(datos({capital:1234567,tasaMensualPct,meses,cargosIniciales:7})),e=>e.statusCode===422);continue;}
  const r=S.simular(datos({capital:1234567,tasaMensualPct,meses,cargosIniciales:7}));let saldo=cent(r.capitalCop),amort=0n,interes=0n,pago=0n;
  for(const x of r.tabla){assert.equal(cent(x.saldoInicialCop),saldo);assert.equal(cent(x.capitalCop)+cent(x.interesCop),cent(x.pagoCop));saldo-=cent(x.capitalCop);assert.equal(cent(x.saldoFinalCop),saldo);assert.ok(saldo>=0n);amort+=cent(x.capitalCop);interes+=cent(x.interesCop);pago+=cent(x.pagoCop);}
  assert.equal(saldo,0n);assert.equal(amort,cent(r.capitalCop));assert.equal(interes,cent(r.interesesEstimados));assert.equal(pago,cent(r.totalCuotasCop));assert.equal(pago+700n,cent(r.costoTotal));assert.doesNotThrow(()=>JSON.stringify(r));
 }
});
test("rechaza coerción, campos ocultos, tasas imprecisas, calendario imposible y plazo no representable",()=>{
 for(const d of [{capital:"1000"},{capital:0.1},{capital:0},{capital:Number.MAX_SAFE_INTEGER+1},{tasaMensualPct:0.1+0.2},{tasaMensualPct:"1e-3"},{tasaMensualPct:" 2"},{tasaMensualPct:"01"},{tasaMensualPct:"100.000001"},{tasaMensualPct:-1},{tasaMensualPct:"0.0000001"},{meses:"12"},{meses:601},{meses:0},{meses:1.5},{cargosIniciales:undefined},{cargosIniciales:null},{cargosIniciales:1000},{cargosIniciales:-1},{cargosIniciales:0.1},{fechaPrimerPago:"2026-02-30"},{fechaPrimerPago:"2026-03-31"},{fechaDesembolso:"2026-01-31T05:00:00Z"},{fechaDesembolso:"1899-01-31"},{fechaDesembolso:"9999-12-31",fechaPrimerPago:"10000-01-31"},{userId:"otro"},{cuentaId:"x"}])assert.throws(()=>S.simular(datos(d)),e=>e.statusCode===422,JSON.stringify(d));
 assert.throws(()=>S.simular(datos({capital:1,tasaMensualPct:"0",meses:600,cargosIniciales:0})),e=>e.statusCode===422);assert.throws(()=>S.simular(datos({tasaMensualPct:"100",meses:600})),e=>e.statusCode===422);assert.throws(()=>S.simular(null));assert.throws(()=>S.simular([]));const d=datos();delete d.cargosIniciales;assert.throws(()=>S.simular(d));
});
test("HTTP real no acepta identidad del cuerpo ni datos incompletos y sanitiza fallos",async()=>{
 const express=require("express"),http=require("node:http"),app=express();app.use(express.json());app.use((req,res,next)=>{if(req.headers.authorization==="Bearer ensayo")req.personalAuth={userId:"propio"};next();});app.post("/simular",S.crearHandler());app.post("/fallo",S.crearHandler(()=>{throw Error("secret 12345");}));
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const url="http://127.0.0.1:"+server.address().port;
 try{for(const [path,body,token,status] of [["simular",datos(),false,401],["simular",datos(),true,200],["simular",datos({userId:"ajeno"}),true,422],["simular",{capital:1000,tasaMensualPct:2,meses:12},true,422],["fallo",datos(),true,503]]){const r=await fetch(url+"/"+path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer ensayo"}:{})},body:JSON.stringify(body)}),json=await r.json();assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"private, no-store");if(status!==200){assert.equal(json.simulacion,undefined);assert.doesNotMatch(JSON.stringify(json),/secret|12345/);}else assert.equal(json.simulacion.tabla.length,2);}}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test("vector independiente Decimal a 90 dígitos: cuota y último pago no se confunden",()=>{
 const r=S.simular(datos({capital:1000000,tasaMensualPct:"1.9",meses:12,cargosIniciales:0}));assert.equal(r.cuotaMensual,"93979.83");assert.equal(r.ultimaCuotaCop,"93979.78");assert.equal(r.interesesEstimados,"127757.91");assert.equal(r.costoTotal,"1127757.91");
});
