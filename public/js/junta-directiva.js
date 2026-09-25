"use strict";

let juntaSesionActualGRUK = null;
let juntaDecisionActualGRUK = null;

function escaparJuntaGRUK(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function textoMultilineaJuntaGRUK(valor) {
  return escaparJuntaGRUK(valor).replace(/\n/g, "<br>");
}

function formatoNumeroJuntaGRUK(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "No estimado";
  }

  const numero = Number(valor);
  return Number.isFinite(numero)
    ? numero.toLocaleString("es-CO")
    : "No estimado";
}

function configurarProcesandoJuntaGRUK(procesando) {
  const indicador = document.getElementById("juntaProcesandoGRUK");
  const boton = document.getElementById("juntaEnviarGRUK");

  if (indicador) indicador.hidden = !procesando;
  if (boton) {
    boton.disabled =
      procesando ||
      !juntaSesionActualGRUK?._id ||
      juntaSesionActualGRUK?.estado === "CERRADA";
    boton.textContent = procesando
      ? "Expertos analizando..."
      : "Preguntar a toda la Junta";
  }
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
      <p>Abre la Junta para que los expertos puedan responder sobre esta decisión.</p>
    `;
  }

  if (lista) lista.innerHTML = "";
}

function esExpertoJuntaGRUK(item) {
  return ["EXPERTO_GRUK", "EXPERTO_IA"].includes(item?.tipo);
}

function nombreActorJuntaGRUK(item) {
  if (item.tipo === "NEURONA") {
    return `DATO · NEURONA ${escaparJuntaGRUK(item.departamento)}`;
  }

  if (esExpertoJuntaGRUK(item)) {
    return `EXPERTO GRUK · ${escaparJuntaGRUK(item.departamento)}`;
  }

  return `PREGUNTA HUMANA · ${escaparJuntaGRUK(item.departamento)}`;
}

function conectarReintentosJuntaGRUK() {
  document
    .querySelectorAll("button[data-junta-reintentar]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        reintentarRespuestaJuntaGRUK(
          boton.dataset.juntaReintentar
        ).catch((error) => {
          console.error("Junta reintento:", error);
          alert(
            error.message ||
            "Los expertos no pudieron responder todavía."
          );
        });
      });
    });
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
      <p><strong>Intervenciones:</strong> ${
        Array.isArray(sesion.intervenciones)
          ? sesion.intervenciones.length
          : 0
      }</p>
    `;
  }

  if (!lista) return;

  const intervenciones = Array.isArray(sesion.intervenciones)
    ? sesion.intervenciones
    : [];

  const respuestasPorPregunta = new Map();
  for (const item of intervenciones) {
    if (
      esExpertoJuntaGRUK(item) &&
      item.respuestaAId
    ) {
      const clave = String(item.respuestaAId);
      respuestasPorPregunta.set(
        clave,
        (respuestasPorPregunta.get(clave) || 0) + 1
      );
    }
  }

  lista.innerHTML = intervenciones.map((item) => {
    const evidencia = item.evidencia
      ? `<p><strong>Evidencia utilizada:</strong> ${escaparJuntaGRUK(item.evidencia)}</p>`
      : "";

    const esDatoNeurona = item.tipo === "NEURONA";
    const esExperto = esExpertoJuntaGRUK(item);

    const metricas = esDatoNeurona
      ? `
        <p><strong>Impacto financiero estimado:</strong> ${formatoNumeroJuntaGRUK(item.impacto_financiero_estimado)}</p>
        <p><strong>Confianza del dato:</strong> ${
          item.confianza === null || item.confianza === undefined
            ? "No aplica"
            : escaparJuntaGRUK(`${Number(item.confianza)}%`)
        }</p>
      `
      : "";

    const notaExperto = esExperto
      ? `
        <p><strong>Confianza profesional:</strong> ${
          item.confianza === null || item.confianza === undefined
            ? "No estimada"
            : escaparJuntaGRUK(`${Number(item.confianza)}%`)
        }</p>
        <p><small>Deliberación experta sobre evidencia GRUK y contexto humano. No es una orden del Cerebro.</small></p>
      `
      : "";

    const tieneRespuesta = item.tipo === "HUMANO"
      ? (respuestasPorPregunta.get(String(item._id)) || 0) >= 6
      : true;

    const reintento =
      item.tipo === "HUMANO" &&
      !tieneRespuesta &&
      !cerrada
        ? `<button type="button" data-junta-reintentar="${escaparJuntaGRUK(item._id)}">Pedir respuesta a los expertos</button>`
        : "";

    return `<div class="card">
      <h3>${nombreActorJuntaGRUK(item)}</h3>
      <p>${textoMultilineaJuntaGRUK(item.mensaje)}</p>
      ${evidencia}
      ${metricas}
      ${notaExperto}
      ${reintento}
    </div>`;
  }).join("");

  conectarReintentosJuntaGRUK();
}

async function cargarJuntaUltimaDecisionGRUK() {
  const resDecision = await grukFetch("/api/cerebro/ultima-decision");
  const dataDecision = await resDecision.json();

  if (!resDecision.ok || !dataDecision.ok) {
    throw new Error(
      dataDecision.error ||
      "No fue posible consultar la última decisión."
    );
  }

  if (!dataDecision.decision?._id) {
    throw new Error(
      "El Cerebro todavía no tiene una decisión para discutir."
    );
  }

  juntaDecisionActualGRUK = dataDecision.decision;

  const res = await grukFetch(
    `/api/junta/decisiones/${encodeURIComponent(
      juntaDecisionActualGRUK._id
    )}`
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
      "No fue posible consultar la Junta."
    );
  }

  if (data.sesion) {
    renderizarJuntaGRUK(data.sesion);
  } else {
    renderizarJuntaSinSesionGRUK(
      juntaDecisionActualGRUK
    );
  }
}

async function abrirJuntaDirectivaGRUK() {
  if (!juntaDecisionActualGRUK?._id) {
    throw new Error(
      "No existe una decisión del Cerebro para discutir."
    );
  }

  if (juntaSesionActualGRUK?._id) return;

  const res = await grukFetch(
    `/api/junta/decisiones/${encodeURIComponent(
      juntaDecisionActualGRUK._id
    )}/abrir`,
    { method: "POST" }
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
      "No fue posible abrir la Junta."
    );
  }

  renderizarJuntaGRUK(data.sesion);
}

async function cerrarJuntaDirectivaGRUK() {
  if (!juntaSesionActualGRUK?._id) {
    throw new Error(
      "No existe una sesión de Junta abierta."
    );
  }

  if (juntaSesionActualGRUK.estado === "CERRADA") return;
  if (!confirm("Cerrar esta discusión de Junta Directiva?")) return;

  const res = await grukFetch(
    `/api/junta/sesiones/${encodeURIComponent(
      juntaSesionActualGRUK._id
    )}/cerrar`,
    { method: "POST" }
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
      "No fue posible cerrar la Junta."
    );
  }

  renderizarJuntaGRUK(data.sesion);
}

async function reintentarRespuestaJuntaGRUK(intervencionId) {
  if (!juntaSesionActualGRUK?._id) {
    throw new Error(
      "No existe una sesión de Junta abierta."
    );
  }

  configurarProcesandoJuntaGRUK(true);

  try {
    const res = await grukFetch(
      `/api/junta/sesiones/${encodeURIComponent(
        juntaSesionActualGRUK._id
      )}/intervenciones/${encodeURIComponent(
        intervencionId
      )}/responder`,
      { method: "POST" }
    );
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Los expertos no pudieron responder."
      );
    }

    renderizarJuntaGRUK(data.sesion);
  } finally {
    configurarProcesandoJuntaGRUK(false);
  }
}

async function agregarIntervencionJuntaGRUK() {
  if (!juntaSesionActualGRUK?._id) {
    throw new Error(
      "No existe una sesión de Junta abierta."
    );
  }

  const departamento =
    document.getElementById("juntaDepartamentoGRUK")?.value;
  const input =
    document.getElementById("juntaMensajeGRUK");
  const mensaje = input?.value?.trim() || "";

  if (!mensaje) {
    alert("Escribe una pregunta antes de enviarla.");
    return;
  }

  configurarProcesandoJuntaGRUK(true);

  try {
    const res = await grukFetch(
      `/api/junta/sesiones/${encodeURIComponent(
        juntaSesionActualGRUK._id
      )}/intervenciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          departamento,
          mensaje
        })
      }
    );
    const data = await res.json();

    if (data.sesion) {
      renderizarJuntaGRUK(data.sesion);
    }

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        "La pregunta quedó guardada, pero los expertos no pudieron responder."
      );
    }

    if (input) input.value = "";
    renderizarJuntaGRUK(data.sesion);
  } finally {
    configurarProcesandoJuntaGRUK(false);
  }
}

async function inicializarJuntaDirectivaGRUK() {
  const estado =
    document.getElementById("juntaEstadoGRUK");

  try {
    await cargarJuntaUltimaDecisionGRUK();

    const botonAbrir =
      document.getElementById("juntaAbrirGRUK");

    if (botonAbrir) {
      botonAbrir.addEventListener("click", () => {
        abrirJuntaDirectivaGRUK().catch((error) => {
          console.error("Junta apertura:", error);
          alert(
            error.message ||
            "No fue posible abrir la Junta."
          );
        });
      });
    }

    const botonEnviar =
      document.getElementById("juntaEnviarGRUK");

    if (botonEnviar) {
      botonEnviar.addEventListener("click", () => {
        agregarIntervencionJuntaGRUK().catch((error) => {
          console.error("Junta pregunta:", error);
          alert(
            error.message ||
            "No fue posible consultar a los expertos."
          );
        });
      });
    }

    const botonCerrar =
      document.getElementById("juntaCerrarGRUK");

    if (botonCerrar) {
      botonCerrar.addEventListener("click", () => {
        cerrarJuntaDirectivaGRUK().catch((error) => {
          console.error("Junta cierre:", error);
          alert(
            error.message ||
            "No fue posible cerrar la Junta."
          );
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
      estado.innerHTML = `<p>${escaparJuntaGRUK(
        error.message ||
        "No fue posible consultar la Junta."
      )}</p>`;
    }
  }
}
