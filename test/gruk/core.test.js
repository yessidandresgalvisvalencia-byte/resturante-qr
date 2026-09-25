"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularActivacionModulos } = require("../../core/modulos/modulos.service");
const { roleCheck, ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");

test("Gente no se activa con 15 empleados", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 15, clientesRecurrentes: 0 }).gente, false);
});

test("Gente se activa con 16 empleados", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 16, clientesRecurrentes: 0 }).gente, true);
});

test("Servicio al Cliente no se activa con 100 recurrentes", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 100 }).servicio_cliente, false);
});

test("Servicio al Cliente se activa con 101 recurrentes", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 101 }).servicio_cliente, true);
});

test("EMPLEADO recibe 403 en una frontera reservada a Finanzas", () => {
  const middleware = roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE);
  const req = { auth: { rol: ROLES_GRUK.EMPLEADO } };
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; }
  };
  middleware(req, res, () => assert.fail("EMPLEADO no debe pasar"));
  assert.equal(statusCode, 403);
  assert.equal(payload.ok, false);
});


test("Cerebro desempata por confianza y luego menor riesgo de caja", () => {
  const { compararCandidatos } = require("../../intelligence/brain/cerebro");
  const base = { hallazgo: { impacto_financiero_estimado: 1000, confianza: 90 } };
  const marketing = { ...base, regla: { departamento: "MARKETING" } };
  const finanzas = { ...base, regla: { departamento: "FINANZAS" } };
  assert.ok(compararCandidatos(finanzas, marketing) < 0);

  const ventasMayorConfianza = {
    hallazgo: { impacto_financiero_estimado: 1000, confianza: 95 },
    regla: { departamento: "VENTAS" }
  };
  assert.ok(compararCandidatos(ventasMayorConfianza, finanzas) < 0);
});


test("filtroTenant nunca permite a ADMIN_SEDE consultar otra sede", () => {
  const { filtroTenant } = require("../../intelligence/brain/cerebro.service");
  const auth = {
    empresaId: "64b000000000000000000001",
    sedeId: "64b000000000000000000002",
    rol: ROLES_GRUK.ADMIN_SEDE
  };
  const filtro = filtroTenant(auth, {
    _id: "64b000000000000000000003",
    sedeId: "64b000000000000000000099"
  });
  assert.equal(String(filtro.empresaId), auth.empresaId);
  assert.equal(String(filtro.sedeId), auth.sedeId);
});

test("filtroTenant rechaza ADMIN_SEDE sin sede autorizada", () => {
  const { filtroTenant } = require("../../intelligence/brain/cerebro.service");
  assert.throws(
    () => filtroTenant({
      empresaId: "64b000000000000000000001",
      sedeId: null,
      rol: ROLES_GRUK.ADMIN_SEDE
    }),
    (error) => error.statusCode === 403
  );
});


test("Peluqueria de 3 empleados mantiene modulos automaticos apagados", () => {
  assert.deepEqual(
    calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 0 }),
    { gente: false, servicio_cliente: false }
  );
});

test("Restaurante de 18 empleados activa Gente sin inventar Servicio al Cliente", () => {
  assert.deepEqual(
    calcularActivacionModulos({ empleadosActuales: 18, clientesRecurrentes: 0 }),
    { gente: true, servicio_cliente: false }
  );
});


test("Cerebro inmediato solo se dispara con KPI CRITICO", () => {
  const { debeTomarDecision } = require("../../intelligence/orchestrator/cicloInteligencia");
  const reportesAlerta = [
    { kpi_principal: { estado: "ALERTA" }, necesita_decision_de_cerebro: true }
  ];
  const reportesCritico = [
    { kpi_principal: { estado: "CRITICO" }, necesita_decision_de_cerebro: false }
  ];

  assert.equal(debeTomarDecision(reportesAlerta, false), false);
  assert.equal(debeTomarDecision(reportesCritico, false), true);
  assert.equal(debeTomarDecision(reportesAlerta, true), true);
});


test("Las cinco neuronas implementan el contrato GRUK", () => {
  const neuronas = [
    require("../../intelligence/neurons/finanzas.neuron"),
    require("../../intelligence/neurons/ventas.neuron"),
    require("../../intelligence/neurons/marketing.neuron"),
    require("../../intelligence/neurons/operaciones.neuron"),
    require("../../intelligence/neurons/gente.neuron")
  ];

  assert.equal(neuronas.length, 5);
  for (const neurona of neuronas) {
    assert.equal(typeof neurona.getRequiredEvents, "function");
    assert.equal(typeof neurona.analyze, "function");
    assert.ok(Array.isArray(neurona.getRequiredEvents()));
  }
});

test("Empresa nueva activa inteligencia GRUK por defecto", () => {
  const Empresa = require("../../models/Empresa");
  const empresa = new Empresa({
    empresaId: "emp_test_default_intelligence",
    nombre: "Empresa Test",
    tipoNegocio: "servicios",
    correo: "test@example.com"
  });

  assert.equal(empresa.modulos.inteligencia, true);
});


test("Situacion ejecutiva refleja ordenes pendientes aunque no haya CRITICOS", () => {
  const { construirSituacion } = require("../../intelligence/brain/cerebro");
  const texto = construirSituacion([], [{}, {}, {}, {}]);
  assert.equal(texto, "4 orden(es) empresariales requieren seguimiento.");
});

test("Situacion ejecutiva combina funciones criticas y ordenes", () => {
  const { construirSituacion } = require("../../intelligence/brain/cerebro");
  const texto = construirSituacion([{}], [{}, {}]);
  assert.equal(texto, "1 funcion(es) critica(s) requieren atencion y 2 orden(es) esperan gestion.");
});


test("Junta preserva KPI sin dato y solo usa impactos reportados", () => {
  const {
    construirIntervencionNeurona
  } = require("../../intelligence/board/junta.service");

  const intervencion = construirIntervencionNeurona({
    neurona: "MARKETING",
    kpi_principal: {
      nombre: "cac",
      valor_actual: null,
      valor_objetivo: 10000,
      estado: "ALERTA"
    },
    hallazgos: [{
      tipo: "DATOS_INSUFICIENTES",
      evidencia: "No existen datos atribuibles suficientes.",
      impacto_financiero_estimado: 0,
      confianza: 100
    }]
  });

  assert.match(intervencion.mensaje, /Valor actual: sin dato/);
  assert.equal(intervencion.impacto_financiero_estimado, 0);
  assert.equal(intervencion.confianza, 100);
  assert.equal(intervencion.departamento, "MARKETING");
});

test("Junta suma impacto y promedia confianza de evidencia determinista", () => {
  const {
    construirIntervencionNeurona
  } = require("../../intelligence/board/junta.service");

  const intervencion = construirIntervencionNeurona({
    neurona: "FINANZAS",
    kpi_principal: {
      nombre: "margen",
      valor_actual: 20,
      valor_objetivo: 35,
      estado: "CRITICO"
    },
    hallazgos: [
      { evidencia: "A", impacto_financiero_estimado: 1000, confianza: 80 },
      { evidencia: "B", impacto_financiero_estimado: 500, confianza: 100 }
    ]
  });

  assert.equal(intervencion.impacto_financiero_estimado, 1500);
  assert.equal(intervencion.confianza, 90);
  assert.equal(intervencion.departamento, "FINANZAS");
});


test("Memoria determina mejora segun direccion del KPI", () => {
  const { compararResultado } = require("../../intelligence/memory/memoria.service");

  assert.equal(
    compararResultado({
      baseline: { medible: true, valor: 50 },
      seguimiento: { medible: true, valor: 75 },
      direccion: "MAYOR_ES_MEJOR"
    }),
    "MEJORO"
  );

  assert.equal(
    compararResultado({
      baseline: { medible: true, valor: 20 },
      seguimiento: { medible: true, valor: 5 },
      direccion: "MENOR_ES_MEJOR"
    }),
    "MEJORO"
  );

  assert.equal(
    compararResultado({
      baseline: { medible: false, valor: null },
      seguimiento: { medible: true, valor: 10 },
      direccion: "MAYOR_ES_MEJOR"
    }),
    "NO_MEDIBLE"
  );
});

test("Memoria evalua cumplimiento de objetivo sin inventar dato", () => {
  const { evaluarObjetivo } = require("../../intelligence/memory/memoria.service");

  assert.equal(
    evaluarObjetivo({
      seguimiento: { medible: true, valor: 100, objetivo: 100 },
      direccion: "MAYOR_ES_MEJOR"
    }),
    true
  );

  assert.equal(
    evaluarObjetivo({
      seguimiento: { medible: false, valor: null, objetivo: 100 },
      direccion: "MAYOR_ES_MEJOR"
    }),
    null
  );
});

test("Configuracion CORE mide solo los cinco objetivos requeridos", () => {
  const { medirConfiguracionCore } = require("../../intelligence/memory/kpi.service");

  assert.equal(
    medirConfiguracionCore({
      configuracion: {
        margen_objetivo: 30,
        punto_equilibrio: 1000000,
        ticket_objetivo: 50000,
        cac_maximo: null,
        empleados_actuales: 10
      }
    }),
    80
  );
});


test("Inventario configurado usa un KPI distinto a porcentaje agotado", () => {
  const { KPI_DIRECCION } = require("../../intelligence/memory/kpi.service");
  assert.equal(KPI_DIRECCION.inventario_configurado, "MAYOR_ES_MEJOR");
  assert.equal(KPI_DIRECCION.porcentaje_items_agotados, "MENOR_ES_MEJOR");
});


test("Junta deterministica entrega seis perspectivas sin proveedor externo", async () => {
  const {
    generarRespuestasExpertas,
    DEPARTAMENTOS_EXPERTOS
  } = require("../../intelligence/board/expertos.service");

  const resultado = await generarRespuestasExpertas({
    pregunta: "¿Qué corregimos primero?",
    reportes: [{
      neurona: "FINANZAS",
      kpi_principal: {
        nombre: "margen",
        valor_actual: 20,
        valor_objetivo: 35,
        estado: "CRITICO"
      },
      hallazgos: [{
        tipo: "MARGEN_BAJO_OBJETIVO",
        evidencia: "Margen por debajo del objetivo.",
        impacto_financiero_estimado: 0,
        confianza: 100
      }]
    }],
    intervenciones: []
  });

  assert.equal(resultado.model, "GRUK-CONSULTIVO-2");
  assert.equal(resultado.respuestas.length, 6);
  assert.deepEqual(
    resultado.respuestas.map((item) => item.departamento),
    DEPARTAMENTOS_EXPERTOS
  );
  assert.match(resultado.respuestas[0].respuesta, /FINANZAS/);
  assert.ok(resultado.respuestas[0].evidencia_usada.some((item) => /Margen/.test(item)));
});

test("Junta conserva correccion humana como contexto y no como hecho", async () => {
  const { generarRespuestasExpertas } = require("../../intelligence/board/expertos.service");

  const resultado = await generarRespuestasExpertas({
    pregunta: "¿Qué corregimos?",
    reportes: [],
    intervenciones: [{
      tipo: "HUMANO",
      mensaje: "El proveedor cambió las condiciones ayer."
    }]
  });

  const finanzas = resultado.respuestas.find((item) => item.departamento === "FINANZAS");
  assert.match(finanzas.respuesta, /intervenciones humanas previas/);
  assert.equal(finanzas.evidencia_usada.length, 0);
});

test("Intervencion experta queda ligada a la pregunta sin cifras inventadas", () => {
  const mongoose = require("mongoose");
  const {
    construirIntervencionExperta
  } = require("../../intelligence/board/junta.service");

  const preguntaId = new mongoose.Types.ObjectId();
  const intervencion = construirIntervencionExperta({
    intervencionId: preguntaId,
    model: "modelo-test",
    respuesta: {
      departamento: "FINANZAS",
      respuesta: "Primero validaria la cobertura de costos.",
      evidencia_usada: ["7 ventas no tienen costo congelado confiable."],
      inferencias: ["Sin costo confiable no conviene concluir margen real."],
      datos_faltantes: ["Costo real de las ventas historicas."]
    }
  });

  assert.equal(intervencion.tipo, "EXPERTO_IA");
  assert.equal(intervencion.departamento, "FINANZAS");
  assert.equal(String(intervencion.respuestaAId), String(preguntaId));
  assert.equal(intervencion.impacto_financiero_estimado, null);
  assert.equal(intervencion.confianza, null);
  assert.match(intervencion.mensaje, /Inferencias profesionales/);
  assert.match(intervencion.mensaje, /Datos faltantes/);
});

test("Junta reconoce escenario desde cero y no arrastra historico", async () => {
  const { generarRespuestasExpertas, clasificarIntencion } = require("../../intelligence/board/expertos.service");
  assert.equal(clasificarIntencion("Supongamos que vamos a empezar desde cero, ¿cómo lo hacemos?"), "ARRANQUE");
  const resultado = await generarRespuestasExpertas({
    pregunta: "Supongamos que vamos a empezar desde cero, ¿cómo lo hacemos?",
    reportes: [{
      neurona: "FINANZAS",
      kpi_principal: { nombre: "margen", valor_actual: 1, valor_objetivo: 99, estado: "CRITICO" },
      hallazgos: [{ evidencia: "Dato historico que no debe gobernar el supuesto." }]
    }],
    intervenciones: []
  });
  assert.equal(resultado.intencion, "ARRANQUE");
  assert.equal(resultado.respuestas.length, 6);
  assert.ok(resultado.respuestas.every(r => !r.evidencia_usada.includes("Dato historico que no debe gobernar el supuesto.")));
  assert.match(resultado.respuestas.at(-1).respuesta, /cliente y oferta/);
});

test("Junta formatea KPI sin decimales interminables", async () => {
  const { generarRespuestasExpertas } = require("../../intelligence/board/expertos.service");
  const resultado = await generarRespuestasExpertas({
    pregunta: "Explícame el estado de ventas",
    reportes: [{
      neurona: "VENTAS",
      kpi_principal: { nombre: "ticket_promedio", valor_actual: 17141.428571428572, valor_objetivo: null, estado: "ALERTA" },
      hallazgos: []
    }],
    intervenciones: []
  });
  const ventas = resultado.respuestas.find(r => r.departamento === "VENTAS");
  assert.ok(ventas.evidencia_usada.some(x => /17[.,]141[.,]43/.test(x)));
  assert.ok(!ventas.evidencia_usada.some(x => /428571428572/.test(x)));
});

