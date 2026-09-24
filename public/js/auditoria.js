"use strict";

function escaparAuditoriaGRUK(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function inicializarAuditoriaGRUK() {
  const contenedor = document.getElementById("auditoriaGRUK");
  if (!contenedor) return;

  contenedor.innerHTML = "<p>Cargando auditoría...</p>";

  try {
    const res = await grukFetch("/api/cerebro/auditoria?limit=100");
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No fue posible consultar la auditoría.");
    }

    const eventos = Array.isArray(data.eventos) ? data.eventos : [];
    if (!eventos.length) {
      contenedor.innerHTML = "<p>No existen eventos auditados todavía.</p>";
      return;
    }

    contenedor.innerHTML = eventos.map((evento) => {
      const fecha = evento.createdAt
        ? new Date(evento.createdAt).toLocaleString("es-CO")
        : "Sin fecha";

      return `<div class="card">
        <h3>${escaparAuditoriaGRUK(evento.accion)} · ${escaparAuditoriaGRUK(evento.departamento || "SIN_DEPARTAMENTO")}</h3>
        <p><strong>Tipo:</strong> ${escaparAuditoriaGRUK(evento.tipo || "EVENTO")}</p>
        <p><strong>Actor:</strong> ${escaparAuditoriaGRUK(evento.actor || "HUMANO")}</p>
        <p><strong>Usuario:</strong> ${escaparAuditoriaGRUK(evento.usuarioId || "Sistema")}</p>
        <p><strong>Tarea:</strong> ${escaparAuditoriaGRUK(evento.tarea || "No disponible")}</p>
        <p><strong>KPI:</strong> ${escaparAuditoriaGRUK(evento.kpi_a_medir || "No disponible")}</p>
        <p><strong>Rol:</strong> ${escaparAuditoriaGRUK(evento.rol || "No disponible")}</p>
        <p><strong>Fecha:</strong> ${escaparAuditoriaGRUK(fecha)}</p>
        <p><strong>Contexto:</strong> ${escaparAuditoriaGRUK(evento.situacion || "No disponible")}</p>
      </div>`;
    }).join("");
  } catch (error) {
    console.error("Auditoría GRUK:", error);
    contenedor.innerHTML = "<p>No fue posible cargar la auditoría.</p>";
  }
}
