"use strict";

let juntaSesionActualGRUK = null;
let juntaDecisionActualGRUK = null;

function escaparJuntaGRUK(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatoNumeroJuntaGRUK(valor) {
  if (valor === null || valor === undefined || valor === "") return "No estimado";
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("es-CO") : "No estimado";
}

function configurarControlesJuntaGRUK({ existe, cerrada }) {
  const botonAbrir = document.getElementById("juntaAbrirGRUK");
  const botonCerrar = document.getElementById("juntaCerrarGRUK");
  const botonEnviar = document.getElementById("juntaEnviarGRUK");
  const mensajeInput = document.getElementById("juntaMensajeGRUK");
  const departamentoInput = document.getElementById("juntaDepartamentoGRUK");

  if (botonAbrir) botonAbrir.disabled = existe;
  if (botonCerrar) botonCerrar.disabled = !existe || cerrada;
  if (botonEnviar) botonEnviar.disabled = !existe || cerrada;
  if (mensajeInput) mensajeInput.disabled = !existe || cerrada;
  if (departamentoInput) departamentoInput.disabled = !existe || cerrada;
}

function renderizarJuntaSinSesionGRUK(decision) {
  juntaSesionActualGRUK = null;

  const estado = document.getElementById("juntaEstadoGRUK");
  const lista = document.getElementById("juntaIntervencionesGRUK");

  configurarControlesJuntaGRUK({
    existe: false,
    cerrada: false
  });

  if (estado) {
    estado.innerHTML = `
      <h2>Discusión aún no abierta</h2>
      <p><strong>Decisión:</strong> ${escaparJuntaGRUK(decision._id)}</p>
      <p>Abre la Junta cuando quieras iniciar formalmente la discusión.</p>
    `;
  }

  if (lista) lista.innerHTML = "";
}

function renderizarJuntaGRUK(sesion) {
  juntaSesionActualGRUK = sesion;

  const estado = document.getElementById("juntaEstadoGRUK");
  const lista = document.getElementById("juntaIntervencionesGRUK");
  const cerrada = sesion.estado === "CERRADA";

  configurarControlesJuntaGRUK({
    existe: true,
    cerrada
  });

  if (estado) {
    estado.innerHTML = `
      <h2>Sesión ${escaparJuntaGRUK(sesion.estado)}</h2>
      <p><strong>Decisión:</strong> ${escaparJuntaGRUK(sesion.decisionId)}</p>
      <p><strong>Intervenciones:</strong> ${Array.isArray(sesion.intervenciones) ? sesion.intervenciones.length : 0}</p>
    `;
  }

  if (!lista) return;

  const intervenciones = Array.isArray(sesion.intervenciones)
    ? sesion.intervenciones
    : [];

  lista.innerHTML = intervenciones.map((item) => {
    const actor = item.tipo === "NEURONA"
      ? `NEURONA ${escaparJuntaGRUK(item.departamento)}`
      : `HUMANO · ${escaparJuntaGRUK(item.departamento)}`;

    const evidencia = item.evidencia
      ? `<p><strong>Evidencia:</strong> ${escaparJuntaGRUK(item.evidencia)}</p>`
      : "";

    const confianza = item.confianza === null || item.confianza === undefined
      ? "No aplica"
      : `${Number(item.confianza)}%`;

    return `<div class="card">
      <h3>${actor}</h3>
      <p>${escaparJuntaGRUK(item.mensaje)}</p>
      ${evidencia}
      <p><strong>Impacto financiero estimado:</strong> ${formatoNumeroJuntaGRUK(item.impacto_financiero_estimado)}</p>
      <p><strong>Confianza:</strong> ${escaparJuntaGRUK(confianza)}</p>
    </div>`;
  }).join("");
}

async function cargarJuntaUltimaDecisionGRUK() {
  const resDecision = await grukFetch("/api/cerebro/ultima-decision");
  const dataDecision = await resDecision.json();

  if (!resDecision.ok || !dataDecision.ok) {
    throw new Error(dataDecision.error || "No fue posible consultar la última decisión.");
  }

  if (!dataDecision.decision?._id) {
    throw new Error("El Cerebro todavía no tiene una decisión para discutir.");
  }

  juntaDecisionActualGRUK = dataDecision.decision;

  const res = await grukFetch(
    `/api/junta/decisiones/${encodeURIComponent(juntaDecisionActualGRUK._id)}`
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No fue posible consultar la Junta.");
  }

  if (data.sesion) {
    renderizarJuntaGRUK(data.sesion);
  } else {
    renderizarJuntaSinSesionGRUK(juntaDecisionActualGRUK);
  }
}

async function abrirJuntaDirectivaGRUK() {
  if (!juntaDecisionActualGRUK?._id) {
    throw new Error("No existe una decisión del Cerebro para discutir.");
  }

  if (juntaSesionActualGRUK?._id) return;

  const res = await grukFetch(
    `/api/junta/decisiones/${encodeURIComponent(juntaDecisionActualGRUK._id)}/abrir`,
    { method: "POST" }
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No fue posible abrir la Junta.");
  }

  renderizarJuntaGRUK(data.sesion);
}

async function cerrarJuntaDirectivaGRUK() {
  if (!juntaSesionActualGRUK?._id) {
    throw new Error("No existe una sesión de Junta abierta.");
  }

  if (juntaSesionActualGRUK.estado === "CERRADA") return;
  if (!confirm("Cerrar esta discusión de Junta Directiva?")) return;

  const res = await grukFetch(
    `/api/junta/sesiones/${encodeURIComponent(juntaSesionActualGRUK._id)}/cerrar`,
    { method: "POST" }
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No fue posible cerrar la Junta.");
  }

  renderizarJuntaGRUK(data.sesion);
}

async function agregarIntervencionJuntaGRUK() {
  if (!juntaSesionActualGRUK?._id) {
    throw new Error("No existe una sesión de Junta abierta.");
  }

  const departamento = document.getElementById("juntaDepartamentoGRUK")?.value;
  const input = document.getElementById("juntaMensajeGRUK");
  const mensaje = input?.value?.trim() || "";

  if (!mensaje) {
    alert("Escribe una intervención antes de enviarla.");
    return;
  }

  const boton = document.getElementById("juntaEnviarGRUK");
  if (boton) boton.disabled = true;

  try {
    const res = await grukFetch(
      `/api/junta/sesiones/${encodeURIComponent(juntaSesionActualGRUK._id)}/intervenciones`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departamento, mensaje })
      }
    );
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No fue posible agregar la intervención.");
    }

    if (input) input.value = "";
    renderizarJuntaGRUK(data.sesion);
  } finally {
    if (boton && juntaSesionActualGRUK?.estado !== "CERRADA") {
      boton.disabled = false;
    }
  }
}

async function inicializarJuntaDirectivaGRUK() {
  const estado = document.getElementById("juntaEstadoGRUK");

  try {
    await cargarJuntaUltimaDecisionGRUK();

    const botonAbrir = document.getElementById("juntaAbrirGRUK");
    if (botonAbrir) {
      botonAbrir.addEventListener("click", () => {
        abrirJuntaDirectivaGRUK().catch((error) => {
          console.error("Junta apertura:", error);
          alert(error.message || "No fue posible abrir la Junta.");
        });
      });
    }

    const botonEnviar = document.getElementById("juntaEnviarGRUK");
    if (botonEnviar) {
      botonEnviar.addEventListener("click", () => {
        agregarIntervencionJuntaGRUK().catch((error) => {
          console.error("Junta intervención:", error);
          alert(error.message || "No fue posible agregar la intervención.");
        });
      });
    }

    const botonCerrar = document.getElementById("juntaCerrarGRUK");
    if (botonCerrar) {
      botonCerrar.addEventListener("click", () => {
        cerrarJuntaDirectivaGRUK().catch((error) => {
          console.error("Junta cierre:", error);
          alert(error.message || "No fue posible cerrar la Junta.");
        });
      });
    }
  } catch (error) {
    console.error("Junta Directiva:", error);
    configurarControlesJuntaGRUK({
      existe: false,
      cerrada: false
    });
    if (estado) {
      estado.innerHTML = `<p>${escaparJuntaGRUK(error.message || "No fue posible consultar la Junta.")}</p>`;
    }
  }
}
