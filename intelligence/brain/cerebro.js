"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Reporte=require("../models/CerebroReporteNeurona");
const Decision=require("../models/CerebroDecision");
const Auditoria=require("../models/CerebroAuditoria");
const NEURONAS=["FINANZAS","VENTAS","MARKETING","OPERACIONES","GENTE"];
const MAPA={
 MARGEN_BAJO_OBJETIVO:{departamento:"FINANZAS",tarea:"Revisar costos y margen bruto frente al objetivo configurado.",kpi:"margen_bruto_confiable"},
 COSTO_NO_CONFIABLE:{departamento:"FINANZAS",tarea:"Completar costos confiables de los productos vendidos.",kpi:"cobertura_costo_porcentaje"},
 TICKET_BAJO_OBJETIVO:{departamento:"VENTAS",tarea:"Revisar ticket promedio y mezcla de productos frente al objetivo.",kpi:"ticket_promedio"},
 INVENTARIO_AGOTADO:{departamento:"OPERACIONES",tarea:"Reponer o resolver los items de inventario agotados.",kpi:"porcentaje_items_agotados"},
 SIN_INVENTARIO_CONFIGURADO:{departamento:"OPERACIONES",tarea:"Configurar el inventario operativo para poder medir disponibilidad.",kpi:"inventario_configurado"},
 DATOS_INSUFICIENTES:{departamento:"MARKETING",tarea:"Configurar atribucion de gasto y clientes adquiridos para medir CAC.",kpi:"cac"},
 CONFIGURACION_INCOMPLETA:{departamento:"DIRECCION",tarea:"Completar los objetivos empresariales requeridos por GRUK.",kpi:"configuracion_core"}
};
const RIESGO_CAJA={FINANZAS:0,OPERACIONES:1,VENTAS:2,MARKETING:3,DIRECCION:4,GENTE:5,SERVICIO_CLIENTE:6};

function describirCobrosPriorizados(a){
 const items=Array.isArray(a?.cobrosPriorizados)?a.cobrosPriorizados:[];
 if(!items.length)return "No existen cobros vencidos o con vencimiento dentro de 7 dias suficientes para priorizar.";
 const detalle=items.map((item,index)=>{
  const fecha=item.fechaVencimiento
   ? new Date(item.fechaVencimiento).toISOString().slice(0,10)
   : "sin fecha";
  return `${index+1}. ${item.descripcion||"Venta pendiente"} por ${Number(item.monto||0)} (vence ${fecha}, ${item.clasificacion||"SIN_CLASIFICAR"})`;
 }).join(" ");
 const total=Number(a.montoCobrosPriorizados||0);
 const remanente=Number(a.faltanteDespuesCobrosPriorizados||0);
 return `${detalle} Total priorizado: ${total}.${remanente>0?` Aun faltarian ${remanente} despues de cobrarlos.`:""}`;
}

function describirObligacionesPriorizadas(a){
 const items=Array.isArray(a?.obligacionesPriorizadas)
  ?a.obligacionesPriorizadas
  :[];

 if(!items.length){
  return "No existen obligaciones cuantificadas con vencimiento dentro de 7 dias para ordenar.";
 }

 return items.map((item,index)=>{
  const fecha=item.fechaVencimiento
   ?new Date(item.fechaVencimiento).toISOString().slice(0,10)
   :"sin fecha";
  const categoria=item.categoria
   ?` [${item.categoria}]`
   :"";
  return `${index+1}. ${item.descripcion||"Obligacion"}${categoria} por ${Number(item.monto||0)} (vence ${fecha})`;
 }).join(" ");
}

const AGENDA_TAREAS={
 REDUCIR_BRECHA_CAJA_7D:(a)=>`Cerrar la brecha de caja proyectada de ${Number(a.montoReferencia||0)} antes del vencimiento critico y reportar avance diario.`,
 CONTROLAR_BRECHA_CAJA_7D:(a)=>`Controlar la brecha de caja de corto plazo por ${Number(a.montoReferencia||0)} hasta que los cobros esperados se conviertan en caja confirmada.`,
 ACELERAR_COBROS_7D:(a)=>`Priorizar estos cobros concretos para convertirlos en caja dentro del horizonte de 7 dias: ${describirCobrosPriorizados(a)}`,
 PRIORIZAR_OBLIGACIONES_7D:(a)=>`Priorizar obligaciones por ${Number(a.montoReferencia||0)} dentro de los proximos 7 dias. Orden propuesto: ${describirObligacionesPriorizadas(a)}`,
 COMPLETAR_DATOS_OBLIGACIONES_7D:()=>"Completar fechas de vencimiento y saldos pendientes no cuantificados antes de declarar cobertura de caja de 7 dias.",
 COMPLETAR_TESORERIA:()=>"Completar la configuracion y conciliacion de Tesoreria hasta obtener un saldo disponible verificable."
};
function prioridad(estado,impacto){if(estado==="CRITICO")return"CRITICA";if(impacto>0)return"ALTA";return"MEDIA";}
function construirSituacion(criticos,ordenes){
 const totalCriticos=Array.isArray(criticos)?criticos.length:0;
 const totalOrdenes=Array.isArray(ordenes)?ordenes.length:0;
 if(totalCriticos>0)return `${totalCriticos} funcion(es) critica(s) requieren atencion y ${totalOrdenes} orden(es) esperan gestion.`;
 if(totalOrdenes>0)return `${totalOrdenes} orden(es) empresariales requieren seguimiento.`;
 return "Los cinco KPI principales estan bajo seguimiento sin ordenes pendientes.";
}
function compararCandidatos(a,b){
 const impactoA=Number(a.hallazgo.impacto_financiero_estimado)||0;
 const impactoB=Number(b.hallazgo.impacto_financiero_estimado)||0;
 if(impactoA!==impactoB)return impactoB-impactoA;
 const confianzaA=Number(a.hallazgo.confianza)||0;
 const confianzaB=Number(b.hallazgo.confianza)||0;
 if(confianzaA!==confianzaB)return confianzaB-confianzaA;
 return (RIESGO_CAJA[a.regla.departamento]??99)-(RIESGO_CAJA[b.regla.departamento]??99);
}
async function ultimosReportes(empresaId){
 const rows=await Reporte.find({empresaId,neurona:{$in:NEURONAS},deletedAt:null}).sort({timestamp:-1}).lean();
 const mapa=new Map(); for(const r of rows){if(!mapa.has(r.neurona))mapa.set(r.neurona,r);} return NEURONAS.map(n=>mapa.get(n)).filter(Boolean);
}
function convertirAgendaEnOrdenes(agenda){
 if(!agenda||!Array.isArray(agenda.accionesSugeridas))return[];
 return agenda.accionesSugeridas.map((a)=>({
  departamento:a.departamento,
  tarea:(AGENDA_TAREAS[a.codigo]||(()=>`Atender señal financiera ${a.codigo}.`))(a),
  prioridad:a.prioridad||"ALTA",
  responsableId:null,
  deadline:a.deadline?new Date(a.deadline):null,
  kpi_a_medir:a.kpi_a_medir||"tesoreria_7d",
  automatizable:false
 }));
}

function construirDecisionFingerprint({agenda,candidatos}){
 const payload={
  agenda:agenda?{
   estado7d:agenda.estado7d||null,
   confiabilidad:agenda.confiabilidad||null,
   saldoActual:agenda.saldoActual??null,
   obligaciones7d:Number(agenda.obligaciones7d||0),
   cobros7d:Number(agenda.cobros7d||0),
   faltanteConCajaActual:Number(agenda.faltanteConCajaActual||0),
   faltanteAunCobrandoTodo:Number(agenda.faltanteAunCobrandoTodo||0),
   acciones:(agenda.accionesSugeridas||[]).map(a=>({
    departamento:a.departamento,
    codigo:a.codigo,
    prioridad:a.prioridad,
    kpi:a.kpi_a_medir,
    monto:Number(a.montoReferencia||0),
    cobros:(a.cobrosPriorizados||[]).map(item=>({
     id:String(item.id||""),
     monto:Number(item.monto||0),
     fecha:item.fechaVencimiento
      ?new Date(item.fechaVencimiento).toISOString()
      :null,
     clasificacion:item.clasificacion||null
    }))
   }))
  }:null,
  hallazgos:(candidatos||[]).map(c=>({
   departamento:c.regla.departamento,
   tipo:c.hallazgo.tipo,
   impacto:Number(c.hallazgo.impacto_financiero_estimado||0),
   confianza:Number(c.hallazgo.confianza||0)
  }))
 };
 return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const KPI_FINANCIEROS_AGENDA=new Set([
 "brecha_caja_7d",
 "cobros_confirmados_7d",
 "obligaciones_7d_cubiertas",
 "cobertura_datos_obligaciones_7d",
 "tesoreria_confiable"
]);

function estadoAgendaRequiereAccion(estado7d){
 return [
  "DEFICIT_AUN_COBRANDO_TODO",
  "DEPENDE_DE_COBROS",
  "DATOS_INSUFICIENTES",
  "SIN_SALDO_VERIFICABLE"
 ].includes(estado7d);
}

async function requiereActualizarDecisionFinanciera(empresaId,agenda){
 if(!mongoose.Types.ObjectId.isValid(empresaId))return false;
 const ultima=await Decision.findOne({
  empresaId:new mongoose.Types.ObjectId(String(empresaId)),
  deletedAt:null
 })
  .sort({createdAt:-1})
  .select("contexto_financiero.estado7d")
  .lean();

 const anterior=ultima?.contexto_financiero?.estado7d||null;
 if(!anterior)return false;

 return (
  estadoAgendaRequiereAccion(anterior) &&
  !agenda?.requiereDecision
 );
}

async function superarOrdenesFinancierasPendientes({
 decision,
 nuevaDecisionId
}){
 if(!decision?._id)return 0;

 const documento=await Decision.findById(decision._id);
 if(!documento)return 0;

 const superadas=[];
 const ahora=new Date();

 for(const orden of documento.ordenes_por_departamento||[]){
  if(
   orden.estado==="PENDIENTE_APROBACION" &&
   KPI_FINANCIEROS_AGENDA.has(orden.kpi_a_medir)
  ){
   orden.estado="SUPERADA";
   orden.superadaAt=ahora;
   orden.superadaPorDecisionId=nuevaDecisionId;
   superadas.push(orden);
  }
 }

 if(!superadas.length)return 0;

 await documento.save();

 await Auditoria.insertMany(
  superadas.map((orden)=>({
   empresaId:documento.empresaId,
   sedeId:documento.sedeId||null,
   decisionId:documento._id,
   ordenId:orden._id,
   accion:"SUPERAR",
   usuarioId:null,
   metadata:{
    actor:"SISTEMA",
    nuevaDecisionId:String(nuevaDecisionId)
   },
   deletedAt:null
  }))
 );

 return superadas.length;
}

async function tomarDecision(empresaId,opciones={}){
 if(!mongoose.Types.ObjectId.isValid(empresaId))throw new Error("CEREBRO_EMPRESA_ID_INVALIDO");
 const reportes=await ultimosReportes(empresaId);
 if(reportes.length!==5)throw new Error("CEREBRO_REQUIERE_CINCO_REPORTES");
 const clavePeriodo=(r)=>`${new Date(r.periodo.desde).toISOString()}|${new Date(r.periodo.hasta).toISOString()}`;
 const periodos=new Set(reportes.map(clavePeriodo));
 if(periodos.size!==1)throw new Error("CEREBRO_REPORTES_DE_PERIODOS_DISTINTOS");
 const ahora=Date.now();
 const reporteObsoleto=reportes.some(r=>ahora-new Date(r.timestamp).getTime()>4*60*60*1000);
 if(reporteObsoleto)throw new Error("CEREBRO_REPORTES_OBSOLETOS");
 const candidatos=[];
 for(const r of reportes)for(const h of r.hallazgos||[]){const regla=MAPA[h.tipo];if(regla)candidatos.push({reporte:r,hallazgo:h,regla});}
 candidatos.sort(compararCandidatos);
 const usados=new Set(); const ordenes=[];
 const agenda=opciones.agendaFinanciera||null;
 for(const ordenAgenda of convertirAgendaEnOrdenes(agenda)){
  if(usados.has(ordenAgenda.departamento))continue;
  usados.add(ordenAgenda.departamento);
  ordenes.push(ordenAgenda);
 }
 for(const c of candidatos){if(usados.has(c.regla.departamento))continue;usados.add(c.regla.departamento);ordenes.push({departamento:c.regla.departamento,tarea:c.regla.tarea,prioridad:prioridad(c.reporte.kpi_principal.estado,Number(c.hallazgo.impacto_financiero_estimado)||0),responsableId:null,deadline:new Date(Date.now()+7*86400000),kpi_a_medir:c.regla.kpi,automatizable:false});}
 const criticos=reportes.filter(r=>r.kpi_principal.estado==="CRITICO");
 const confianza=Math.round(reportes.reduce((s,r)=>{const hs=r.hallazgos||[];return s+(hs.length?hs.reduce((x,h)=>x+Number(h.confianza||0),0)/hs.length:100);},0)/5);
 const principal=candidatos[0];
 const decisionFingerprint=
  construirDecisionFingerprint({
   agenda,
   candidatos
  });

 const ultimaDecision=
  await Decision.findOne({
   empresaId:new mongoose.Types.ObjectId(String(empresaId)),
   deletedAt:null
  })
   .sort({createdAt:-1})
   .lean();

 if(
  ultimaDecision?.decisionFingerprint &&
  ultimaDecision.decisionFingerprint===decisionFingerprint
 ){
  return ultimaDecision;
 }

 const causaAgenda=agenda?.requiereDecision
  ? `Tesoreria 7d en estado ${agenda.estado7d}. Obligaciones: ${Number(agenda.obligaciones7d||0)}. Saldo verificable: ${agenda.saldoActual===null?"sin dato":Number(agenda.saldoActual)}.`
  : null;
 const riesgoAgenda=agenda?.estado7d==="DEFICIT_AUN_COBRANDO_TODO"
  ? `Faltante proyectado de ${Number(agenda.faltanteAunCobrandoTodo||0)} aun considerando los cobros esperados.`
  : agenda?.estado7d==="DEPENDE_DE_COBROS"
    ? `La cobertura depende de convertir en caja cobros esperados por hasta ${Number(agenda.cobros7d||0)}.`
    : null;
 const nuevaDecision=(await Decision.create({empresaId:new mongoose.Types.ObjectId(String(empresaId)),sedeId:null,decisionFingerprint,decision_general:{situacion:construirSituacion(criticos,ordenes),causa_raiz:causaAgenda||(principal?principal.hallazgo.evidencia:"No hay hallazgos accionables con los datos actuales."),prediccion:agenda?.requiereDecision?"Sin resolver la señal financiera antes de la fecha critica, la cobertura operativa de corto plazo puede deteriorarse.":(principal?"Sin correccion, el KPI asociado puede continuar fuera del objetivo.":"Mantener seguimiento de los cinco KPI principales.")},ordenes_por_departamento:ordenes,contexto_financiero:agenda?{fuente:agenda.fuente,estado7d:agenda.estado7d,confiabilidad:agenda.confiabilidad,saldoActual:agenda.saldoActual,obligaciones7d:agenda.obligaciones7d,cobros7d:agenda.cobros7d,faltanteConCajaActual:agenda.faltanteConCajaActual,faltanteAunCobrandoTodo:agenda.faltanteAunCobrandoTodo,montoCobrosPriorizados:agenda.montoCobrosPriorizados||0,faltanteDespuesCobrosPriorizados:agenda.faltanteDespuesCobrosPriorizados||0,cobrosPriorizados:(agenda.cobrosPriorizados||[]).map(item=>({ventaId:item.id||null,descripcion:item.descripcion||"",monto:Number(item.monto||0),fechaVencimiento:item.fechaVencimiento||null,clasificacion:item.clasificacion})),fechaCritica:agenda.fechaCritica}:undefined,confianza_global:Math.max(0,Math.min(100,confianza)),riesgo_si_no_se_hace:riesgoAgenda||(principal?principal.hallazgo.evidencia:"No se identifico riesgo cuantificado."),como_medir_exito_en_7_dias:agenda?.requiereDecision?"Recalcular Tesoreria y verificar que la brecha de caja de 7 dias sea cero o que la cobertura quede demostrada con datos completos.":(ordenes.length?"Recalcular los KPI de las ordenes y comparar contra sus objetivos.":"Generar nuevamente los cinco reportes y verificar su estado."),reportesOrigen:reportes.map(r=>r._id),createdBy:null,deletedAt:null})).toObject();

 if(ultimaDecision?._id){
  await superarOrdenesFinancierasPendientes({
   decision:ultimaDecision,
   nuevaDecisionId:nuevaDecision._id
  });
 }

 return nuevaDecision;
}
module.exports={tomarDecision,compararCandidatos,construirSituacion,convertirAgendaEnOrdenes,construirDecisionFingerprint,requiereActualizarDecisionFinanciera,estadoAgendaRequiereAccion,superarOrdenesFinancierasPendientes,describirCobrosPriorizados,describirObligacionesPriorizadas};
