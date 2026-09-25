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
    const financiero = d.contexto_financiero || null;

    const cobrosPrioritarios =
      Array.isArray(financiero?.cobrosPriorizados)
        ? financiero.cobrosPriorizados
        : [];

    const carteraHTML =
      cobrosPrioritarios.length
        ? `
          <h4>Cobros priorizados</h4>
          <ol>
            ${cobrosPrioritarios.map((item) => `
              <li>
                ${escaparGRUK(item.descripcion || "Venta pendiente")}
                · ${formatoCOP(item.monto || 0)}
                · vence ${item.fechaVencimiento
                  ? escaparGRUK(new Date(item.fechaVencimiento).toLocaleDateString("es-CO"))
                  : "sin fecha"}
                · ${escaparGRUK(item.clasificacion || "")}
              </li>
            `).join("")}
          </ol>
          <p><strong>Total priorizado:</strong> ${formatoCOP(financiero.montoCobrosPriorizados || 0)}</p>
          <p><strong>Faltante después de estos cobros:</strong> ${formatoCOP(financiero.faltanteDespuesCobrosPriorizados || 0)}</p>
        `
        : "";

    const planPagoHTML = (titulo, items) => {
      const lista = Array.isArray(items) ? items : [];

      if (!lista.length) return "";

      return `
        <h4>${escaparGRUK(titulo)}</h4>
        <ol>
          ${lista.map((item) => `
            <li>
              ${escaparGRUK(item.descripcion || "Obligación")}
              ${item.categoria ? `[${escaparGRUK(item.categoria)}]` : ""}
              · ${formatoCOP(item.monto || 0)}
              · vence ${item.fechaVencimiento
                ? escaparGRUK(new Date(item.fechaVencimiento).toLocaleDateString("es-CO"))
                : "sin fecha"}
              · <strong>${escaparGRUK(item.estadoCobertura || "")}</strong>
            </li>
          `).join("")}
        </ol>
      `;
    };

    const contextoFinanciero = financiero
      ? `
        <div class="card">
          <h3>Contexto financiero de la decisión</h3>
          <p><strong>Estado 7 días:</strong> ${escaparGRUK(financiero.estado7d || "SIN_DATO")}</p>
          <p><strong>Confiabilidad:</strong> ${escaparGRUK(financiero.confiabilidad || "SIN_DATO")}</p>
          <p><strong>Saldo disponible:</strong> ${financiero.saldoActual === null || financiero.saldoActual === undefined ? "No verificable" : formatoCOP(financiero.saldoActual)}</p>
          <p><strong>Obligaciones 7 días:</strong> ${formatoCOP(financiero.obligaciones7d || 0)}</p>
          <p><strong>Cobros esperados 7 días:</strong> ${formatoCOP(financiero.cobros7d || 0)}</p>
          <p><strong>Brecha con caja actual:</strong> ${formatoCOP(financiero.faltanteConCajaActual || 0)}</p>
          <p><strong>Brecha aun cobrando todo:</strong> ${formatoCOP(financiero.faltanteAunCobrandoTodo || 0)}</p>
          <p><strong>Fecha crítica:</strong> ${financiero.fechaCritica ? escaparGRUK(new Date(financiero.fechaCritica).toLocaleDateString("es-CO")) : "Sin fecha"}</p>
          ${carteraHTML}
          ${planPagoHTML(
            "Plan de pagos con caja actual",
            financiero.planPagosCajaActual
          )}
          ${planPagoHTML(
            "Plan de pagos considerando cobros priorizados",
            financiero.planPagosConCobros
          )}
        </div>
      `
      : "";

    const resumen = `<div class="card"><h2>Cerebro decidió</h2><p><strong>Situación:</strong> ${escaparGRUK(d.decision_general?.situacion)}</p><p><strong>Causa:</strong> ${escaparGRUK(d.decision_general?.causa_raiz)}</p><p><strong>Predicción:</strong> ${escaparGRUK(d.decision_general?.prediccion)}</p><p><strong>Riesgo si no se actúa:</strong> ${escaparGRUK(d.riesgo_si_no_se_hace)}</p><p><strong>Cómo medir éxito en 7 días:</strong> ${escaparGRUK(d.como_medir_exito_en_7_dias)}</p><p><strong>Confianza:</strong> ${Number(d.confianza_global || 0)}%</p></div>` + contextoFinanciero;

    const tarjetas = ordenes.map((o) => {
      const acciones = o.estado === "PENDIENTE_APROBACION"
        ? `<button data-accion="aprobar" data-decision="${escaparGRUK(d._id)}" data-orden="${escaparGRUK(o._id)}">Aprobar</button> <button data-accion="rechazar" data-decision="${escaparGRUK(d._id)}" data-orden="${escaparGRUK(o._id)}">Rechazar</button>`
        : `<p><strong>Estado:</strong> ${escaparGRUK(o.estado)}</p>`;

      const deadline = o.deadline ? new Date(o.deadline).toLocaleDateString("es-CO") : "Sin fecha";
      return `<div class="card"><h3>${escaparGRUK(o.departamento)}</h3><p>${escaparGRUK(o.tarea)}</p><p><strong>Prioridad:</strong> ${escaparGRUK(o.prioridad)}</p><p><strong>KPI:</strong> ${escaparGRUK(o.kpi_a_medir)}</p><p><strong>Fecha límite:</strong> ${escaparGRUK(deadline)}</p>${acciones}</div>`;
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
