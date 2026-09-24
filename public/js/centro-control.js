"use strict";

function escaparGRUK(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function inicializarCentroControlGRUK() {
  await cargarDecisionCerebroGRUK();
}

async function cargarDecisionCerebroGRUK() {
  const contenedor = document.getElementById("cerebroDecisionGRUK");
  if (!contenedor) return;

  try {
    const res = await grukFetch("/api/cerebro/ultima-decision");
    const data = await res.json();

    if (!res.ok || !data.ok) {
      contenedor.innerHTML = "<p>No fue posible consultar al Cerebro.</p>";
      return;
    }

    const d = data.decision;
    if (!d) {
      contenedor.innerHTML = "<p>El Cerebro todavía no ha generado una decisión empresarial.</p>";
      return;
    }

    const ordenes = d.ordenes_por_departamento || [];
    const resumen = `<div class="card"><h2>Cerebro decidió</h2><p><strong>Situación:</strong> ${escaparGRUK(d.decision_general?.situacion)}</p><p><strong>Causa:</strong> ${escaparGRUK(d.decision_general?.causa_raiz)}</p><p><strong>Confianza:</strong> ${Number(d.confianza_global || 0)}%</p></div>`;

    const tarjetas = ordenes.map((o) => {
      const acciones = o.estado === "PENDIENTE_APROBACION"
        ? `<button data-accion="aprobar" data-decision="${escaparGRUK(d._id)}" data-orden="${escaparGRUK(o._id)}">Aprobar</button> <button data-accion="rechazar" data-decision="${escaparGRUK(d._id)}" data-orden="${escaparGRUK(o._id)}">Rechazar</button>`
        : `<p><strong>Estado:</strong> ${escaparGRUK(o.estado)}</p>`;

      return `<div class="card"><h3>${escaparGRUK(o.departamento)}</h3><p>${escaparGRUK(o.tarea)}</p><p><strong>Prioridad:</strong> ${escaparGRUK(o.prioridad)}</p><p><strong>KPI:</strong> ${escaparGRUK(o.kpi_a_medir)}</p>${acciones}</div>`;
    }).join("");

    contenedor.innerHTML = resumen + tarjetas;
    contenedor.querySelectorAll("button[data-accion]").forEach((boton) => {
      boton.addEventListener("click", () => procesarOrdenCerebroGRUK(
        boton.dataset.decision,
        boton.dataset.orden,
        boton.dataset.accion
      ));
    });
  } catch (error) {
    console.error("Cerebro no disponible:", error);
    contenedor.innerHTML = "<p>Error consultando la decisión empresarial.</p>";
  }
}

async function procesarOrdenCerebroGRUK(decisionId, ordenId, accion) {
  if (!["aprobar", "rechazar"].includes(accion)) return;
  const verbo = accion === "aprobar" ? "Aprobar" : "Rechazar";
  if (!confirm(`${verbo} esta orden del Cerebro?`)) return;

  try {
    const res = await grukFetch(
      `/api/cerebro/decisiones/${encodeURIComponent(decisionId)}/ordenes/${encodeURIComponent(ordenId)}/${accion}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || `No se pudo ${accion} la orden.`);
    await cargarDecisionCerebroGRUK();
  } catch (error) {
    console.error(`GRUK ${accion} orden:`, error);
    alert(error.message || `No se pudo ${accion} la orden.`);
  }
}
