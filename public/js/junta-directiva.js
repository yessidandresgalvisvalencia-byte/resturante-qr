"use strict";

let juntaSesionActualGRUK = null;
let juntaDecisionActualGRUK = null;
let juntaVivaTimerGRUK = null;

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

function formatoMonedaJuntaGRUK(valor) {
  const numero = Number(valor || 0);

  return numero.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

async function cargarConfiguracionBaseJuntaGRUK() {
  const contenedor =
    document.getElementById(
      "juntaConfiguracionBaseGRUK"
    );

  if (!contenedor) return;

  try {
    const res =
      await grukFetch(
        "/api/configuracion-inteligencia"
      );

    const data =
      await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        "No fue posible verificar la configuración base."
      );
    }

    const cfg =
      data.configuracion || {};

    if (cfg.completo) {
      contenedor.innerHTML = `
        <h3>Preparación de Inteligencia · ✅ COMPLETA</h3>
        <p>
          Las cinco referencias empresariales base ya están configuradas.
          La Junta puede distinguir objetivos de resultados reales.
        </p>
      `;
      return;
    }

    const faltantes =
      Array.isArray(cfg.faltantes)
        ? cfg.faltantes
        : [];

    contenedor.innerHTML = `
      <h3>Preparación de Inteligencia · ⚠️ ${Number(cfg.configurados || 0)}/${Number(cfg.total || 5)}</h3>
      <p>
        Esto no significa que existan ${faltantes.length} problemas operativos.
        Es una sola tarea de configuración inicial.
      </p>
      <p>
        <strong>Falta completar:</strong>
        ${faltantes
          .map(
            (item) =>
              escaparJuntaGRUK(
                item.etiqueta
              )
          )
          .join(", ")}
      </p>
      <p>
        Ve a Configuración → Configuración base de Inteligencia.
        Al guardarla, GRUK recalcula las neuronas automáticamente.
      </p>
    `;
  } catch (error) {
    contenedor.innerHTML = `
      <h3>Preparación de Inteligencia</h3>
      <p>${escaparJuntaGRUK(
        error.message
      )}</p>
    `;
  }
}

function formatoFechaJuntaGRUK(valor) {
  if (!valor) return "Sin actualización";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Sin actualización";
  }

  return fecha.toLocaleString("es-CO");
}

function renderizarJuntaVivaGRUK(estadoVivo) {
  const contenedor =
    document.getElementById("juntaVivaGRUK");

  if (!contenedor || !estadoVivo) return;

  const ventana =
    estadoVivo.ventana24h || {};
  const diagnostico =
    estadoVivo.diagnostico || {};
  const tesoreria =
    estadoVivo.tesoreria || {};
  const proyeccionTesoreria =
    estadoVivo.proyeccionTesoreria || {};
  const obligaciones =
    estadoVivo.obligaciones || {};
  const evento =
    estadoVivo.ultimoEvento || {};
  const cambio =
    diagnostico.cambioDesdeAnterior || null;
  const historial =
    Array.isArray(
      estadoVivo.historialDiagnosticos
    )
      ? estadoVivo.historialDiagnosticos
          .slice(-3)
          .reverse()
      : [];

  const diagnosticosExpertos =
    Array.isArray(
      estadoVivo.diagnosticosExpertos
    )
      ? estadoVivo.diagnosticosExpertos
      : [];

  const expertosHTML =
    diagnosticosExpertos.length
      ? diagnosticosExpertos.map(
          (item) => {
            const evidencia =
              Array.isArray(item.evidencia)
                ? item.evidencia.slice(0, 3)
                : [];

            const faltantes =
              Array.isArray(item.datosFaltantes)
                ? item.datosFaltantes.slice(0, 3)
                : [];

            return `
              <details>
                <summary>
                  <strong>EXPERTO GRUK · ${escaparJuntaGRUK(
                    item.departamento
                  )}</strong>
                  · relevancia
                  ${escaparJuntaGRUK(
                    item.relevancia
                  )}
                  ${item.confianza !== null &&
                    item.confianza !== undefined
                    ? `· confianza ${escaparJuntaGRUK(
                        item.confianza
                      )}%`
                    : ""}
                </summary>

                <p>${textoMultilineaJuntaGRUK(
                  item.respuesta
                )}</p>

                ${evidencia.length
                  ? `<p><strong>Evidencia:</strong> ${evidencia
                      .map(escaparJuntaGRUK)
                      .join(" | ")}</p>`
                  : ""}

                ${faltantes.length
                  ? `<p><strong>Falta confirmar:</strong> ${faltantes
                      .map(escaparJuntaGRUK)
                      .join(" | ")}</p>`
                  : ""}
              </details>
            `;
          }
        ).join("")
      : "";

  const cuentasTesoreria =
    Array.isArray(
      tesoreria.cuentas
    )
      ? tesoreria.cuentas
      : [];

  const cuentasTesoreriaHTML =
    cuentasTesoreria.length
      ? cuentasTesoreria.map(
          (cuenta) => `
            <li>
              ${escaparJuntaGRUK(
                cuenta.nombre || "Cuenta"
              )}
              ·
              ${escaparJuntaGRUK(
                cuenta.tipo || ""
              )}
              ·
              ${formatoMonedaJuntaGRUK(
                cuenta.saldoDisponible || 0
              )}
            </li>
          `
        ).join("")
      : "<li>Sin cuentas configuradas.</li>";

  const razones =
    Array.isArray(diagnostico.razones)
      ? diagnostico.razones
      : [];

  contenedor.innerHTML = `
    <h2>Junta en vivo · ${escaparJuntaGRUK(
      diagnostico.estado || "NORMAL"
    )}</h2>

    <p><strong>Último movimiento:</strong> ${escaparJuntaGRUK(
      evento.descripcion || "Sin movimientos recientes."
    )}</p>

    <p><strong>Diagnóstico:</strong> ${escaparJuntaGRUK(
      diagnostico.titular || "Sin diagnóstico."
    )}</p>

    <div>
      <h3>Tesorería · ${escaparJuntaGRUK(
        tesoreria.estadoConfiabilidad ||
        "SIN_CONFIGURAR"
      )}</h3>

      <p>
        <strong>Saldo disponible:</strong>
        ${tesoreria.saldoDisponible === null ||
          tesoreria.saldoDisponible === undefined
          ? "No verificable"
          : formatoMonedaJuntaGRUK(
              tesoreria.saldoDisponible
            )}
      </p>

      <p>
        <strong>Sin asignar:</strong>
        entradas
        ${formatoMonedaJuntaGRUK(
          tesoreria.movimientosSinAsignar
            ?.entradas?.monto || 0
        )}
        · salidas
        ${formatoMonedaJuntaGRUK(
          tesoreria.movimientosSinAsignar
            ?.salidas?.monto || 0
        )}
      </p>

      ${tesoreria.advertencia
        ? `<p><strong>Advertencia:</strong> ${escaparJuntaGRUK(
            tesoreria.advertencia
          )}</p>`
        : ""}

      <ul>
        ${cuentasTesoreriaHTML}
      </ul>

      <h4>Obligaciones registradas</h4>

      <p>
        <strong>Cobertura 7 días:</strong>
        ${escaparJuntaGRUK(
          obligaciones.cobertura7Dias ||
          "NO_CALCULABLE"
        )}
      </p>

      <p>
        <strong>Vencidas:</strong>
        ${formatoMonedaJuntaGRUK(
          obligaciones.vencidas
            ?.montoCuantificado || 0
        )}
        ·
        <strong>Próximos 7 días:</strong>
        ${formatoMonedaJuntaGRUK(
          obligaciones.proximos7Dias
            ?.montoCuantificado || 0
        )}
        ·
        <strong>8–30 días:</strong>
        ${formatoMonedaJuntaGRUK(
          obligaciones.dias8a30
            ?.montoCuantificado || 0
        )}
      </p>

      <p>
        <strong>Sin fecha:</strong>
        ${Number(
          obligaciones.obligacionesSinFecha || 0
        )}
        ·
        <strong>Exigibles no cuantificadas:</strong>
        ${Number(
          obligaciones.noCuantificadasExigibles || 0
        )}
      </p>

      <p>
        <strong>Saldo después de obligaciones registradas 7d:</strong>
        ${obligaciones.saldoDespues7Dias === null ||
          obligaciones.saldoDespues7Dias === undefined
          ? "No calculable con confianza"
          : formatoMonedaJuntaGRUK(
              obligaciones.saldoDespues7Dias
            )}
      </p>

      <h4>Proyección 7/30 días</h4>

      <p>
        <strong>Estado 7 días:</strong>
        ${escaparJuntaGRUK(
          proyeccionTesoreria.estado7d ||
          "SIN_SALDO_VERIFICABLE"
        )}
      </p>

      <p>
        <strong>Obligaciones vencidas:</strong>
        ${formatoMonedaJuntaGRUK(
          proyeccionTesoreria.obligacionesVencidas || 0
        )}
        ·
        <strong>hasta 7 días:</strong>
        ${formatoMonedaJuntaGRUK(
          proyeccionTesoreria.obligaciones7d || 0
        )}
        ·
        <strong>hasta 30 días:</strong>
        ${formatoMonedaJuntaGRUK(
          proyeccionTesoreria.obligaciones30d || 0
        )}
      </p>

      <p>
        <strong>Cobros esperados 7 días:</strong>
        ${formatoMonedaJuntaGRUK(
          proyeccionTesoreria.cobros7d || 0
        )}
        ·
        <strong>30 días:</strong>
        ${formatoMonedaJuntaGRUK(
          proyeccionTesoreria.cobros30d || 0
        )}
      </p>

      <p>
        <strong>Días de cobertura sobre salidas históricas:</strong>
        ${proyeccionTesoreria
          .diasCoberturaSalidasHistoricas ?? "No calculable"}
      </p>

      ${proyeccionTesoreria.proximoVencimiento
        ? `<p>
            <strong>Próximo vencimiento:</strong>
            ${escaparJuntaGRUK(
              proyeccionTesoreria.proximoVencimiento.descripcion || ""
            )}
            ·
            ${proyeccionTesoreria.proximoVencimiento.monto === null ||
              proyeccionTesoreria.proximoVencimiento.monto === undefined
              ? "Monto no cuantificado"
              : formatoMonedaJuntaGRUK(
                  proyeccionTesoreria.proximoVencimiento.monto
                )}
            ·
            ${escaparJuntaGRUK(
              formatoFechaJuntaGRUK(
                proyeccionTesoreria.proximoVencimiento.fechaVencimiento
              )
            )}
          </p>`
        : ""}
    </div>

    <p>${escaparJuntaGRUK(
      diagnostico.lectura || ""
    )}</p>

    ${cambio?.explicacion
      ? `<p><strong>Cambio desde la lectura anterior:</strong> ${escaparJuntaGRUK(
          cambio.explicacion
        )}</p>`
      : ""}

    <p>
      <strong>Últimas 24 h · entradas confirmadas:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.ventasPagadas?.monto
      )}
      ·
      <strong>salidas confirmadas por compras:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.comprasPagadas?.monto
      )}
      ·
      <strong>gastos pagados:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.gastosPagados?.monto
      )}
    </p>

    <p>
      <strong>Flujo confirmado parcial:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.flujoConfirmadoParcial
      )}
      ·
      <strong>compras con pago no confirmado:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.comprasNoConfirmadas?.monto
      )}
      ·
      <strong>gastos con pago no confirmado:</strong>
      ${formatoMonedaJuntaGRUK(
        ventana.gastosNoConfirmados?.monto
      )}
    </p>

    ${
      razones.length
        ? `<p><strong>Señales activas:</strong> ${razones
            .map(escaparJuntaGRUK)
            .join(" | ")}</p>`
        : ""
    }

    <p>
      <strong>Cerebro:</strong>
      ${diagnostico.requiereDecisionCerebro
        ? "Hay una señal crítica que requiere decisión."
        : "Sin nueva decisión crítica requerida por este estado."}
    </p>

    ${expertosHTML
      ? `
        <h3>Diagnóstico automático de la Junta</h3>
        <p><small>
          Los expertos relevantes reaccionan automáticamente a los movimientos y KPI actuales. Es criterio consultivo; no son órdenes del Cerebro.
        </small></p>
        ${expertosHTML}
      `
      : ""}

    ${historial.length
      ? `
        <p><strong>Últimas lecturas:</strong></p>
        <ul>
          ${historial.map((item) => `
            <li>
              ${escaparJuntaGRUK(
                formatoFechaJuntaGRUK(item.createdAt)
              )} ·
              ${escaparJuntaGRUK(item.estado)} ·
              flujo parcial
              ${formatoMonedaJuntaGRUK(
                item.flujoConfirmadoParcial
              )}
            </li>
          `).join("")}
        </ul>
      `
      : ""}

    <p><small>
      Actualizado: ${escaparJuntaGRUK(
        formatoFechaJuntaGRUK(
          estadoVivo.ultimoCambioAt
        )
      )}. El flujo confirmado proviene del libro canónico de caja. GRUK solo descuenta compras y gastos con pago confirmado; los históricos sin estado permanecen fuera del flujo confirmado.
    </small></p>
  `;
}

async function cargarJuntaVivaGRUK() {
  const res = await grukFetch(
    "/api/junta/viva"
  );
  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
      "No fue posible consultar la Junta en vivo."
    );
  }

  renderizarJuntaVivaGRUK(
    data.estado
  );
}

function iniciarRefrescoJuntaVivaGRUK() {
  if (juntaVivaTimerGRUK) {
    clearInterval(
      juntaVivaTimerGRUK
    );
  }

  juntaVivaTimerGRUK = setInterval(() => {
    cargarJuntaVivaGRUK().catch(
      (error) => {
        console.error(
          "Junta viva:",
          error
        );
      }
    );
  }, 10000);
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

  const visibles = intervenciones.filter(
    (item) =>
      !esExpertoJuntaGRUK(item) ||
      item.relevancia !== "NINGUNA"
  );

  lista.innerHTML = visibles.map((item) => {
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
        <p><strong>Relevancia:</strong> ${
          item.relevancia
            ? escaparJuntaGRUK(item.relevancia)
            : "No clasificada"
        }</p>
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
  const estadoVivo =
    document.getElementById("juntaVivaGRUK");

  await cargarConfiguracionBaseJuntaGRUK();

  try {
    await cargarJuntaVivaGRUK();
  } catch (error) {
    console.error(
      "Junta viva inicial:",
      error
    );

    if (estadoVivo) {
      estadoVivo.innerHTML =
        `<h2>Junta en vivo</h2><p>${escaparJuntaGRUK(
          error.message ||
          "No fue posible consultar el estado vivo."
        )}</p>`;
    }
  }

  iniciarRefrescoJuntaVivaGRUK();

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
