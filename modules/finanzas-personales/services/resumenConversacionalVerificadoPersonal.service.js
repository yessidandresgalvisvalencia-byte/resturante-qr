"use strict";
const mongoose=require("mongoose"),H=require("./homePersonal.service"),P=require("../models/prestamoPersonal.model"),{exigirPrestamosPatrimonio}=require("./patrimonioPersonal.service");
const tipos=["RESUMEN","CUENTAS_POR_COBRAR","DEUDA"],error=()=>new TypeError("Fuentes de resumen no verificables");
function resumenHome(h,corte){
 if(!(corte instanceof Date)||!Number.isFinite(+corte)||h?.moneda!=="COP"||!(h.corte instanceof Date)||+h.corte!==+corte||!h.mes)throw error();
 const m=h.mes,v=h.verdadFinanciera?.flujoMes;
 for(const k of ["ingresosMinor","cobrosCuentasPorCobrarMinor","gastosMinor","gastosConsumoMinor","pagosDeudaRegistradosMinor"])if(!Number.isSafeInteger(m[k])||m[k]<0)throw error();
 const total=H.sumarImportesHome([m.ingresosMinor,m.cobrosCuentasPorCobrarMinor,-m.gastosMinor,-m.pagosDeudaRegistradosMinor]);
 if(!Number.isSafeInteger(m.flujoRealizadoMinor)||m.flujoRealizadoMinor!==total||m.gastosConsumoMinor<m.gastosMinor||!v||v.tipo!=="HECHO"||v.fuente!=="LEDGER_PERSONAL"||v.confianza!=="ALTA"||v.requiereReconciliacion!==false||v.montoMinor!==total||!(v.corte instanceof Date)||+v.corte!==+corte)throw error();
 return{periodo:{desde:H._fechas.monthStart(corte).toISOString(),hastaInclusivo:corte.toISOString(),zona:"America/Bogota"},moneda:"COP",ingresosMinor:m.ingresosMinor,cobrosRecibidosMinor:m.cobrosCuentasPorCobrarMinor,gastosMinor:m.gastosMinor,gastosConsumoMinor:m.gastosConsumoMinor,pagosDeudaMinor:m.pagosDeudaRegistradosMinor,flujoRealizadoMinor:total,flujoLibreMinor:null,autorizaGasto:false,corte:corte.toISOString(),fuente:"HOME_SNAPSHOT_COMPENSADO"};
}
function prestamos(usuarioId,rows,tipo,corte){
 if(!["CUENTAS_POR_COBRAR","DEUDA"].includes(tipo))throw error();
 exigirPrestamosPatrimonio(usuarioId,rows);const direccion=tipo==="DEUDA"?"POR_PAGAR":"POR_COBRAR";
 for(const p of rows)if(p.direccion!==direccion||!Number.isSafeInteger(p.cuotaMinor)||p.cuotaMinor<0||typeof p.concepto!=="string"||p.concepto.length>160||typeof p.contraparte!=="string"||p.contraparte.length>140||/[\x00-\x1f]/.test(p.concepto+p.contraparte))throw error();
 // Validar también saldos cero: un filtro saldo>0 ocultaría fuentes negativas.
 const activas=rows.filter(p=>p.saldoMinor>0),totalMinor=H.sumarImportesHome(activas.map(p=>p.saldoMinor));
 const mensualConocido=tipo==="DEUDA"&&activas.every(p=>p.cuotaMinor>0&&p.periodicidad==="MENSUAL"&&p.periodicidadConfirmada===true);
 const cuotasMinor=mensualConocido?H.sumarImportesHome(activas.map(p=>p.cuotaMinor)):null;
 const fuentes=activas.map(p=>({id:String(p._id),concepto:p.concepto,contraparte:p.contraparte,saldoMinor:p.saldoMinor,estado:p.estado,fuente:"PRESTAMO_PERSONAL"}));
 return{moneda:"COP",totalMinor,cantidad:activas.length,completo:true,fuentes,autorizaGasto:false,corte:corte.toISOString(),fuente:"PRESTAMOS_PERSONALES_SNAPSHOT",...(tipo==="DEUDA"?{saldoMinor:totalMinor,cuotasMinor,cuotasMensualesConocidas:mensualConocido,deudas:fuentes}:{cuentas:fuentes})};
}
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
function presentar(d,tipo){
 let lineas;
 if(tipo==="RESUMEN"){
  const fecha=s=>new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",dateStyle:"short"}).format(new Date(s));
  lineas=[(d.flujoRealizadoMinor<0?"🔴":"🟡")+" Flujo de caja registrado, no Disponible Hoy.","Período Colombia: "+fecha(d.periodo.desde)+" a "+fecha(d.periodo.hastaInclusivo)+".","Ingresos "+money(d.ingresosMinor)+"; cobros de préstamos "+money(d.cobrosRecibidosMinor)+".","Salidas por gasto "+money(d.gastosMinor)+"; pagos de deuda "+money(d.pagosDeudaMinor)+".","Flujo realizado: "+money(d.flujoRealizadoMinor)+". No autoriza gasto ni acredita ahorro.","Acción: revisa los movimientos y fuentes del período."];
 }else if(tipo==="CUENTAS_POR_COBRAR")lineas=["🟡 Por cobrar registrado: "+money(d.totalMinor)+" en "+d.cantidad+" fuente(s).","Incluye préstamos activos y vencidos con saldo pendiente.","Ese dinero no es caja recibida ni Disponible Hoy.","Acción: revisa cada cuenta y confirma el cobro cuando ocurra."];
 else lineas=["🟡 Deudas registradas: "+money(d.totalMinor)+" en "+d.cantidad+" fuente(s).",d.cuotasMensualesConocidas?"Cuotas mensuales confirmadas: "+money(d.cuotasMinor)+".":"Hay cuota o periodicidad sin confirmar; no calculo un total mensual.","El saldo total no equivale a lo exigible hoy ni autoriza gasto.","Acción: revisa saldos, calendarios y fuentes de las deudas."];
 return{tipo,respuesta:lineas.join("\n"),datos:d,fuente:d.fuente};
}
function fallo(tipo){return{tipo,respuesta:"🟡 No pude verificar todas las fuentes de esta consulta.\nNo muestro un total parcial ni lo sustituyo por cero.\nAcción: actualiza la consulta y revisa las fuentes pendientes.",datos:{completo:false,totalMinor:null,saldoMinor:null,flujoRealizadoMinor:null,flujoLibreMinor:null,autorizaGasto:false,motivo:"RESUMEN_NO_VERIFICABLE"},fuente:"FUENTES_PERSONALES"};}
async function consultar(usuarioId,{tipo="RESUMEN",ahora=new Date()}={}){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!tipos.includes(tipo)||!(ahora instanceof Date)||!Number.isFinite(+ahora))throw Object.assign(new Error("Consulta de resumen inválida"),{statusCode:400});
 const corte=new Date(+ahora);
 if(tipo==="RESUMEN")try{return presentar(resumenHome(await H.obtener(usuarioId,new Date(+corte)),corte),tipo);}catch{return fallo(tipo);}
 if(mongoose.connection.readyState!==1)return fallo(tipo);
 let session,datos,invalido=false;
 try{session=await mongoose.startSession();await session.withTransaction(async()=>{
  const rows=await P.find({usuarioId,direccion:tipo==="DEUDA"?"POR_PAGAR":"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]}}).sort({_id:1}).limit(501).maxTimeMS(5000).session(session).lean();datos=prestamos(usuarioId,rows,tipo,corte);
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}catch{invalido=true;}
 finally{if(session)try{await session.endSession();}catch{invalido=true;}}
 return invalido?fallo(tipo):presentar(datos,tipo);
}
module.exports={resumenHome,prestamos,presentar,consultar};
