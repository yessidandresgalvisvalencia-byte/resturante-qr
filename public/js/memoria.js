"use strict";

function escaparMemoriaGRUK(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatearValorMemoriaGRUK(valor) {
  if (valor === null || valor === undefined) return "Sin dato";
  const numero = Number(valor);
  return Number.isFinite(numero)
    ? numero.toLocaleString("es-CO", { maximumFractionDigits: 2 })
    : escaparMemoriaGRUK(valor);
}

function etiquetaResultadoMemoriaGRUK(resultado) {
  const mapa = {
    PENDIENTE: "Pendiente de evaluación",
    MEJORO: "Mejoró",
    SIN_CAMBIO: "Sin cambio",
    EMPEORO: "Empeoró",
    NO_MEDIBLE: "No medible"
  };
  return mapa[resultado] || resultado;
}

async function inicializarMemoriaGRUK() {
  const contenedor = document.getElementById("memoriaResultadosGRUK");
  if (!contenedor) return;

  contenedor.innerHTML = "<p>Cargando memoria...</p>";

  try {
    const res = await grukFetch("/api/memoria?limit=100");
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No fue posible consultar la memoria.");
    }

    const memorias = Array.isArray(data.memorias) ? data.memorias : [];

    if (!memorias.length) {
      contenedor.innerHTML =
        "<p>No existen órdenes aprobadas con memoria de seguimiento todavía.</p>";
      return;
    }

    contenedor.innerHTML = memorias.map((memoria) => {
      const baseline = memoria.baseline || {};
      const seguimiento = memoria.seguimiento || {};
      const evaluarAt = memoria.evaluarAt
        ? new Date(memoria.evaluarAt).toLocaleString("es-CO")
        : "Sin fecha";

      const seguimientoTexto = memoria.resultado === "PENDIENTE"
        ? `<p><strong>Evaluación programada:</strong> ${escaparMemoriaGRUK(evaluarAt)}</p>`
        : `
          <p><strong>Valor a 7 días:</strong> ${formatearValorMemoriaGRUK(seguimiento.valor)}</p>
          <p><strong>Objetivo:</strong> ${formatearValorMemoriaGRUK(seguimiento.objetivo)}</p>
          <p><strong>Cumplió objetivo:</strong> ${
            memoria.cumplioObjetivo === null
              ? "No determinable"
              : memoria.cumplioObjetivo ? "Sí" : "No"
          }</p>
        `;

      return `<div class="card">
        <h3>${escaparMemoriaGRUK(memoria.departamento)} · ${escaparMemoriaGRUK(memoria.kpi)}</h3>
        <p><strong>Resultado:</strong> ${escaparMemoriaGRUK(etiquetaResultadoMemoriaGRUK(memoria.resultado))}</p>
        <p><strong>Valor al aprobar:</strong> ${formatearValorMemoriaGRUK(baseline.valor)}</p>
        <p><strong>Objetivo:</strong> ${formatearValorMemoriaGRUK(baseline.objetivo)}</p>
        ${seguimientoTexto}
      </div>`;
    }).join("");
  } catch (error) {
    console.error("Memoria GRUK:", error);
    contenedor.innerHTML = "<p>No fue posible cargar la memoria de resultados.</p>";
  }
}
