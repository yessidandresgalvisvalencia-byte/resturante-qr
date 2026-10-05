"use strict";
const mongoose=require("mongoose");
const PrestamoPersonal=require("../models/prestamoPersonal.model");
const patrimonioFinanciero=require("./patrimonioPersonal.service");
const Movimiento=require("../models/movimiento.model");const Transaccion=require("../models/TransaccionPersonal");const Credito=require("../models/credito.model");const Perfil=require("../models/perfil.model");const Meta=require("../models/meta.model");const Activo=require("../models/activo.model");const Inversion=require("../models/inversion.model");const PerfilInversion=require("../models/perfilInversion.model");
function gastoAfectaCaja(tx){return Boolean(tx&&tx.tipo==="GASTO"&&tx.medioPago!=="CREDITO");}
async function registrarMovimiento(userId,data){const session=await mongoose.startSession();try{let doc;await session.withTransaction(async()=>{[doc]=await Movimiento.create([{userId,...data}],{session});});return doc;}finally{await session.endSession();}}
async function diario(userId,{desde,hasta,limit=100}){const q={usuarioId:userId,tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}};if(desde||hasta){q.fecha={};if(desde)q.fecha.$gte=new Date(desde);if(hasta)q.fecha.$lte=new Date(hasta);}const rows=await Transaccion.find(q).sort({fecha:-1,createdAt:-1}).limit(Math.min(limit,500)).lean();const porDia={};for(const x of rows){const dia=new Date(x.fecha).toISOString().slice(0,10),monto=x.montoMinor;porDia[dia]??={fecha:dia,ingresos:0,gastos:0,balance:0,movimientos:[]};porDia[dia][x.tipo==="INGRESO"?"ingresos":"gastos"]+=monto;porDia[dia].balance+=x.tipo==="INGRESO"?monto:-monto;porDia[dia].movimientos.push({...x,monto});}return Object.values(porDia).sort((a,b)=>b.fecha.localeCompare(a.fecha));}
async function resumenPeriodo(userId,{desde,hasta}){const inicio=new Date(desde),fin=new Date(hasta);if(Number.isNaN(inicio.getTime())||Number.isNaN(fin.getTime())||inicio>fin)throw Object.assign(new Error("Periodo inválido"),{statusCode:400});const q={usuarioId:userId,fecha:{$gte:inicio,$lte:fin},tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}};const m=await Transaccion.find(q).lean();const ingresos=m.filter(x=>x.tipo==="INGRESO").reduce((a,x)=>a+x.montoMinor,0),gastos=m.filter(x=>x.tipo==="GASTO").reduce((a,x)=>a+x.montoMinor,0);const categorias={};for(const x of m){const k=x.categoria||"Sin categoría";categorias[k]??={ingresos:0,gastos:0};categorias[k][x.tipo==="INGRESO"?"ingresos":"gastos"]+=x.montoMinor;}return{desde,hasta,ingresos,gastos,balance:ingresos-gastos,categorias,fuente:"ledger_canonico"};}
async function upsertPerfil(userId,data){return Perfil.findOneAndUpdate({userId},{$set:data,$setOnInsert:{userId}},{new:true,upsert:true,runValidators:true});}
async function registrarActivo(userId,data){
 const session=await mongoose.startSession();
 try{
  let legacy,canonico;
  await session.withTransaction(async()=>{
   [legacy]=await Activo.create([{userId,...data}],{session});
   const ActivoPatrimonial=require("../models/ActivoPatrimonial");
   [canonico]=await ActivoPatrimonial.create([{usuarioId:userId,legacyId:legacy._id,nombre:data.nombre,tipo:data.tipo==="INVERSION"?"OTRO":data.tipo,valorMinor:Math.round(data.valorActual),moneda:"COP",liquido:Boolean(data.liquido),institucion:data.institucion||""}],{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return canonico;
 }finally{await session.endSession();}
}
async function registrarInversion(userId,data){return Inversion.create({userId,...data});}
async function upsertPerfilInversion(userId,data){return PerfilInversion.findOneAndUpdate({userId},{$set:data,$setOnInsert:{userId}},{new:true,upsert:true,runValidators:true});}
async function patrimonio(userId){const p=await patrimonioFinanciero.snapshot(userId);return{activosBase:p.activosTotalesMinor,valorInversiones:0,capitalInvertido:0,resultadoInversiones:0,deudas:p.pasivosMinor,patrimonioNeto:p.patrimonioFinancieroNetoMinor,cuentasPorCobrar:p.cuentasPorCobrarMinor,inversiones:[],fuente:"ledger_personal_canonico"};}
async function planFinanciero(userId){const [r,p,pi,pat]=await Promise.all([resumen(userId),Perfil.findOne({userId}).lean(),PerfilInversion.findOne({userId}).lean(),patrimonio(userId)]);const gastoMensualEstimado=r.gastos/Math.max(1,1);const objetivoFondo=gastoMensualEstimado*(p?.fondoEmergenciaObjetivoMeses||6);const brechaFondo=Math.max(0,objetivoFondo-(p?.saldoLiquido||0));const excedente=Math.max(0,r.flujoLibre);const reservaSugerida=Math.min(excedente,brechaFondo);const capacidadInvertible=Math.max(0,excedente-reservaSugerida);const bloqueos=[];if(r.flujoLibre<=0)bloqueos.push("No hay flujo libre positivo registrado.");if(brechaFondo>0)bloqueos.push("El fondo de emergencia está por debajo del objetivo configurado.");if(r.cargaDeudaPct>35)bloqueos.push("La carga de deuda registrada supera el umbral de alerta del 35%.");return{patrimonio:pat,flujoLibre:r.flujoLibre,objetivoFondoEmergencia:objetivoFondo,brechaFondoEmergencia:brechaFondo,reservaFondoSugerida:reservaSugerida,capacidadInvertibleAhora:capacidadInvertible,perfilInversion:pi||null,bloqueos,criterio:"La capacidad invertible se calcula después de flujo y brecha del fondo de emergencia. El 35% es un umbral operativo configurable, no una regla universal ni una garantía de idoneidad."};}
async function registrarCredito(userId,data){return Credito.create({userId,...data});}
async function crearMeta(userId,data){return Meta.create({userId,...data});}
async function resumen(userId,now=new Date()){
 const inicio=new Date(now.getFullYear(),now.getMonth(),1),fin=new Date(now.getFullYear(),now.getMonth()+1,1);
 const [m,deudas,pat,metas]=await Promise.all([
  Transaccion.find({usuarioId:userId,fecha:{$gte:inicio,$lt:fin},tipo:{$in:["INGRESO","GASTO","PAGO_DEUDA"]},estado:{$ne:"ANULADA"}}).lean(),
  PrestamoPersonal.find({usuarioId:userId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).lean(),
  patrimonioFinanciero.snapshot(userId),
  Meta.find({userId,estado:"ACTIVA"}).lean()
 ]);
 const ingresos=m.filter(x=>x.tipo==="INGRESO").reduce((a,x)=>a+x.montoMinor,0);
 const gastosConsumo=m.filter(x=>x.tipo==="GASTO").reduce((a,x)=>a+x.montoMinor,0);const gastos=m.filter(gastoAfectaCaja).reduce((a,x)=>a+x.montoMinor,0);
 const pagosDeuda=m.filter(x=>x.tipo==="PAGO_DEUDA").reduce((a,x)=>a+x.montoMinor,0);
 const deudaTotal=deudas.reduce((a,x)=>a+x.saldoMinor,0);
 const cuotasVencenMes=deudas.filter(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=inicio&&new Date(x.fechaVencimiento)<fin).reduce((a,x)=>a+Math.min(x.cuotaMinor||x.saldoMinor,x.saldoMinor),0);
 const cuotasDeuda=Math.max(0,cuotasVencenMes-pagosDeuda);
 const flujoLibre=ingresos-gastos-pagosDeuda-cuotasDeuda;
 const carga=ingresos?((pagosDeuda+cuotasDeuda)/ingresos)*100:0;
 const gastoBaseMensual=gastos;
 const mesesFondo=gastoBaseMensual>0?Number((pat.liquidezMinor/gastoBaseMensual).toFixed(2)):0;
 return{ingresos,gastos,gastosConsumo,pagosDeudaRegistrados:pagosDeuda,cuotasDeuda,flujoLibre,deudaTotal,cargaDeudaPct:Number(carga.toFixed(2)),tasaAhorroPct:ingresos?Number((flujoLibre/ingresos*100).toFixed(2)):0,fondoEmergencia:{saldo:pat.liquidezMinor,mesesCubiertos:mesesFondo,objetivoMeses:6},patrimonioNeto:pat.patrimonioFinancieroNetoMinor,metasActivas:metas.map(x=>({id:x._id,nombre:x.nombre,objetivo:x.objetivo,acumulado:x.acumulado,progresoPct:x.objetivo?Number((x.acumulado/x.objetivo*100).toFixed(2)):0})),periodo:{desde:inicio,hasta:fin},fuente:"ledger_personal_canonico"};
}
function simularCredito({capital,tasaMensualPct,meses}){const r=tasaMensualPct/100;const cuota=r===0?capital/meses:capital*(r*Math.pow(1+r,meses))/(Math.pow(1+r,meses)-1);const total=cuota*meses;const tea=(Math.pow(1+r,12)-1)*100;return{cuotaMensual:Number(cuota.toFixed(2)),costoTotal:Number(total.toFixed(2)),interesesEstimados:Number((total-capital).toFixed(2)),tasaMensualPct,tasaEfectivaAnualPct:Number(tea.toFixed(2)),meses};}
async function evaluarCredito(userId,input){const base=await resumen(userId);const simulacion=simularCredito(input);const flujoPosterior=base.flujoLibre-simulacion.cuotaMensual;const cargaPosterior=base.ingresos?((base.cuotasDeuda+simulacion.cuotaMensual)/base.ingresos)*100:null;return{simulacion,contexto:{ingresosRegistrados:base.ingresos,flujoLibreActual:base.flujoLibre,flujoLibrePosterior:Number(flujoPosterior.toFixed(2)),cargaDeudaPosteriorPct:cargaPosterior===null?null:Number(cargaPosterior.toFixed(2))},alertas:[...(flujoPosterior<0?["La cuota proyectada llevaría el flujo libre registrado a terreno negativo."]:[]),...(cargaPosterior!==null&&cargaPosterior>35?["La carga mensual de deuda proyectada supera el 35% de los ingresos registrados."]:[])],supuestos:"Cálculo determinístico con los datos registrados; no incluye seguros, comisiones, impuestos ni cambios futuros salvo que se incorporen al escenario."};}
module.exports={gastoAfectaCaja,registrarMovimiento,diario,resumenPeriodo,upsertPerfil,registrarActivo,registrarInversion,upsertPerfilInversion,patrimonio,planFinanciero,registrarCredito,crearMeta,resumen,simularCredito,evaluarCredito};