"use strict";
function escaparGRUK(valor){return String(valor??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function inicializarCentroControlGRUK(){await cargarDecisionCerebroGRUK();}
async function cargarDecisionCerebroGRUK(){
 const contenedor=document.getElementById("cerebroDecisionGRUK"); if(!contenedor)return;
 try{
  const res=await grukFetch("/api/cerebro/ultima-decision"); const data=await res.json();
  if(!res.ok||!data.ok){contenedor.innerHTML="<p>No fue posible consultar al Cerebro.</p>";return;}
  const d=data.decision;if(!d){contenedor.innerHTML="<p>El Cerebro todavía no ha generado una decisión empresarial.</p>";return;}
  const ordenes=d.ordenes_por_departamento||[];
  contenedor.innerHTML=`<div class="card"><h2>Cerebro decidió</h2><p><strong>Situación:</strong> ${escaparGRUK(d.decision_general?.situacion)}</p><p><strong>Causa:</strong> ${escaparGRUK(d.decision_general?.causa_raiz)}</p><p><strong>Confianza:</strong> ${Number(d.confianza_global||0)}%</p></div>`+
  ordenes.map(o=>`<div class="card"><h3>${escaparGRUK(o.departamento)}</h3><p>${escaparGRUK(o.tarea)}</p><p><strong>Prioridad:</strong> ${escaparGRUK(o.prioridad)}</p><p><strong>KPI:</strong> ${escaparGRUK(o.kpi_a_medir)}</p>${o.estado==="PENDIENTE_APROBACION"?`<button onclick="aprobarOrdenCerebroGRUK('${d._id}','${o._id}')">Aprobar</button>`:`<p><strong>Estado:</strong> ${escaparGRUK(o.estado)}</p>`}</div>`).join("");
 }catch(error){console.error("Cerebro no disponible:",error);contenedor.innerHTML="<p>Error consultando la decisión empresarial.</p>";}
}
async function aprobarOrdenCerebroGRUK(decisionId,ordenId){
 if(!confirm("¿Aprobar esta orden del Cerebro?"))return;
 const res=await grukFetch(`/api/cerebro/decisiones/${encodeURIComponent(decisionId)}/ordenes/${encodeURIComponent(ordenId)}/aprobar`,{method:"POST"});
 const data=await res.json();if(!res.ok||!data.ok){alert(data.error||"No se pudo aprobar la orden.");return;}await cargarDecisionCerebroGRUK();
}


async function rechazarOrdenGRUK(decisionId, ordenId){
 try{
  const res=await grukFetch(`/api/cerebro/decisiones/${encodeURIComponent(decisionId)}/ordenes/${encodeURIComponent(ordenId)}/rechazar`,{method:"POST"});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"No se pudo rechazar la orden");
  await cargarCentroControl();
 }catch(error){
  console.error("GRUK rechazar orden:",error);
  alert(error.message||"No se pudo rechazar la orden");
 }
}
window.rechazarOrdenGRUK=rechazarOrdenGRUK;
