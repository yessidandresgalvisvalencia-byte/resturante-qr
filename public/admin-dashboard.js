"use strict";
const params=new URLSearchParams(location.search);
const restaurantId=params.get("restaurantId")||params.get("restaurant")||localStorage.getItem("adminRestaurantId")||"rest1";
const money=v=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v||0));
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url){const fn=typeof grukFetch==="function"?grukFetch:fetch;const r=await fn(url);const d=await r.json();if(!r.ok)throw new Error(d.error||"No fue posible consultar GRUK");return d}
async function ventas(){
 const r=await fetch("/estadisticas/pareto?restaurantId="+encodeURIComponent(restaurantId));if(!r.ok)throw new Error("Sin ventas verificables");const d=await r.json();
 const items=Array.isArray(d)?d:[];const pedidos=items.reduce((a,x)=>a+Number(x.ventas||0),0);const total=items.reduce((a,x)=>a+Number(x.totalCalculado||x.totalDinero||x.total||0),0);
 document.getElementById("ventas").textContent=money(total);document.getElementById("pedidos").textContent=pedidos;document.getElementById("ticket").textContent=pedidos?money(total/pedidos):money(0);return{total,pedidos}
}
function bloqueExplicacion(x){
 return '<div class="explain"><div><span class="label">Qué detectó</span>'+esc(x.que||"Señal empresarial registrada.")+'</div><div><span class="label">Cómo lo sabe</span>'+esc(x.como||"Con los datos registrados en GRUK.")+'</div><div><span class="label">Por qué importa</span>'+esc(x.porQue||"Puede afectar el resultado del negocio.")+'</div><div><span class="label">Para qué actuar</span>'+esc(x.paraQue||"Para corregir la desviación y medir el resultado.")+'</div></div>'
}
async function junta(){
 const d=await api("/api/junta/viva");const e=d.estado||{},diag=e.diagnostico||{},tes=e.tesoreria||{};
 document.getElementById("caja").textContent=tes.saldoDisponible==null?"Por verificar":money(tes.saldoDisponible);
 const expertos=(e.diagnosticosExpertos||[]).filter(x=>x&&x.relevancia!=="NINGUNA");
 const at=document.getElementById("atencion");
 if(expertos.length){at.innerHTML=expertos.slice(0,4).map(x=>'<article class="card attention"><div class="who">QUIÉN LO DICE · '+esc(x.departamento)+'</div><h3>'+esc(x.prioridadProfesional||x.respuesta||"Asunto para revisar")+'</h3>'+bloqueExplicacion({que:x.respuesta,como:(x.evidencia||[]).join(" · ")||"Datos operativos y KPI disponibles.",porQue:x.riesgo||x.objecion||"La Junta lo marcó como relevante.",paraQue:x.primerPaso||"Revisar la acción propuesta."})+'<p><strong>Cómo medir:</strong> '+esc(x.comoMedir||"GRUK necesita definir un KPI verificable.")+'</p></article>').join("")}
 else at.innerHTML='<article class="card ok"><h3>No hay una señal automática prioritaria ahora</h3><p class="muted">Esto no significa que todo sea perfecto. Significa que, con los datos disponibles, la Junta no tiene evidencia suficiente para levantar una alerta. GRUK no inventará una.</p></article>';
 document.getElementById("estadoGeneral").innerHTML='<strong>Lectura actual: '+esc(diag.estado||"SIN CLASIFICAR")+'</strong><br>'+esc(diag.titular||"GRUK está reuniendo contexto suficiente para una lectura ejecutiva.");
 return e
}
function diagnosticoProspectivo(e){
 const box=document.getElementById("proyeccion");if(!box)return;
 const reps=Array.isArray(e.reportesNeuronas)?e.reportesNeuronas:[];const candidatos=reps.filter(r=>r&&r.evaluabilidad==="EVALUABLE"&&Number.isFinite(Number(r.valorActual))&&Number.isFinite(Number(r.valorObjetivo)));
 if(!candidatos.length){box.innerHTML='<article class="card attention"><div class="who">ATTE. DIRECCIÓN GRUK</div><h3>Aún no puedo cuantificar hacia dónde vas</h3>'+bloqueExplicacion({que:"Falta una serie comparable o un KPI evaluable con objetivo.",como:"GRUK exige datos medibles antes de proyectar aumentos o disminuciones.",porQue:"Una sola lectura no demuestra una tendencia.",paraQue:"Evitar que tomes decisiones sobre una proyección inventada."})+'</article>';return}
 box.innerHTML=candidatos.slice(0,3).map(r=>{const actual=Number(r.valorActual),objetivo=Number(r.valorObjetivo),brecha=actual-objetivo,pct=objetivo!==0?(brecha/Math.abs(objetivo))*100:null;const dir=brecha>=0?"por encima":"por debajo";const firma=r.neurona||"DIRECCION";return '<article class="card '+(r.estado==="CRITICO"?"critical":r.estado==="OK"?"ok":"attention")+'"><div class="who">ATTE. '+esc(firma)+' GRUK</div><h3>Si mantienes el nivel actual, seguirás '+dir+' de tu referencia</h3><p><strong>'+esc(r.kpi||"KPI")+'</strong>: actual '+esc(actual.toLocaleString("es-CO"))+' · referencia '+esc(objetivo.toLocaleString("es-CO"))+'.</p><p>'+(pct===null?"La referencia es cero; no es válido expresar la brecha como porcentaje.":"La brecha actual equivale a "+Math.abs(pct).toFixed(1)+"% "+dir+" de la referencia.")+'</p>'+bloqueExplicacion({que:"GRUK observa una brecha de "+Math.abs(brecha).toLocaleString("es-CO")+" en este KPI.",como:"Comparando el valor real medido por la neurona con el objetivo configurado.",porQue:"Si las condiciones no cambian, la brecha no se corrige por sí sola.",paraQue:r.estado==="OK"?"Conservar el comportamiento que sostiene el objetivo.":"Corregir la causa antes de que la desviación siga afectando el negocio."})+'<p><small><strong>Importante:</strong> esto es una proyección de continuidad del nivel actual, no una predicción de crecimiento futuro. Para decir “subirás X% el próximo mes” GRUK necesita historial temporal suficiente.</small></p></article>'}).join("")
}
async function cerebro(){
 const d=await api("/api/cerebro/ultima-decision"),dec=d.decision;
 if(!dec){document.getElementById("decision").innerHTML='<p class="empty">Todavía no existe una decisión del Cerebro con evidencia suficiente.</p>';return}
 const general=dec.decision_general||dec.decisionGeneral||{};
 const ordenes=dec.ordenes_por_departamento||dec.ordenesPorDepartamento||[];
 document.getElementById("decision").innerHTML='<article class="card attention"><div class="who">DECISIÓN DEL CEREBRO</div><h3>'+esc(general.situacion||"Decisión empresarial")+'</h3>'+bloqueExplicacion({que:general.situacion,como:general.causa_raiz||"Cruce de reportes de las neuronas y Junta.",porQue:dec.riesgo_si_no_se_hace||"Existe un hallazgo que requiere decisión.",paraQue:general.prediccion||dec.como_medir_exito_en_7_dias||"Mejorar el KPI afectado."})+'</article>'+ordenes.map(o=>'<div class="order"><strong>'+esc(o.departamento||"ÁREA")+'</strong> · '+esc(o.tarea||"")+'<br><small>KPI a medir: '+esc(o.kpi_a_medir||"por definir")+' · Estado: '+esc(o.estado||"PENDIENTE")+'</small></div>').join("");
 document.getElementById("seguimiento").innerHTML=ordenes.length?ordenes.map(o=>'<div class="order"><strong>'+esc(o.departamento||"ÁREA")+'</strong>: '+esc(o.tarea||"")+'<br><span class="muted">Estado: '+esc(o.estado||"PENDIENTE")+' · Mediremos: '+esc(o.kpi_a_medir||"KPI por definir")+'</span></div>').join(""):'<p class="empty">La última decisión todavía no contiene órdenes medibles.</p>'
}
async function init(){const resultados=await Promise.allSettled([ventas(),junta(),cerebro()]);if(resultados.every(x=>x.status==="rejected"))document.getElementById("estadoGeneral").textContent="No fue posible construir el resumen todavía. Revisa sesión y datos registrados."}
document.addEventListener("DOMContentLoaded",init);