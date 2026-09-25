"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEPARTAMENTOS_EXPERTOS,
  clasificarIntencion,
  detectarTemas,
  extraerHechosHumanos,
  extraerHechosConversacion,
  construirContexto,
  validarRespuestas,
  generarRespuestasExpertas
} = require("../../intelligence/board/expertos.service");

function respuestaValida(departamento) {
  return {
    departamento,
    respuesta: `Respuesta de ${departamento}`,
    criterio_profesional: `Criterio de ${departamento}`,
    evidencia_usada: [],
    inferencias: [],
    riesgos: [],
    objeciones: [],
    acuerdos: [],
    datos_faltantes: [],
    confianza: 80
  };
}

test("la Junta nativa conserva seis expertos y orden canónico", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "Empezando desde cero, ¿cómo crearíamos el flujo de caja?",
    decision: null,
    reportes: [],
    intervenciones: []
  });

  assert.equal(resultado.intencion, "ARRANQUE");
  assert.equal(resultado.respuestas.length, 6);
  assert.deepEqual(
    resultado.respuestas.map((item) => item.departamento),
    DEPARTAMENTOS_EXPERTOS
  );

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );

  assert.match(finanzas.respuesta, /caja/i);
  assert.ok(finanzas.criterio_profesional);
  assert.ok(finanzas.datos_faltantes.length > 0);
  assert.ok(finanzas.confianza > 0);
});

test("detecta caja y margen sin proveedor externo", () => {
  const temas = detectarTemas(
    "¿Cómo cuidamos flujo de caja y margen?"
  );

  assert.ok(temas.includes("FLUJO_CAJA"));
  assert.ok(temas.includes("MARGEN_PRECIO"));
});

test("la intención de corrección tiene prioridad sobre consulta genérica", () => {
  assert.equal(
    clasificarIntencion(
      "Eso no es correcto, corrige el análisis"
    ),
    "CORRECCION"
  );
});

test("el contexto interno minimiza identificadores no necesarios", () => {
  const contexto = construirContexto({
    pregunta: "¿Qué opinan?",
    intencion: "CONSULTA",
    decision: {
      _id: "decision-secreta",
      decision_general: {
        situacion: "Caja presionada",
        causa_raiz: "Causa aún en discusión",
        prediccion: "Requiere seguimiento"
      },
      confianza_global: 70
    },
    reportes: [{
      _id: "reporte-secreto",
      neurona: "FINANZAS",
      kpi_principal: {
        nombre: "caja",
        valor_actual: 10,
        valor_objetivo: 20,
        estado: "ALERTA"
      },
      hallazgos: []
    }],
    intervenciones: [{
      _id: "intervencion-secreta",
      tipo: "HUMANO",
      departamento: "DIRECCION",
      mensaje: "Necesitamos entender la caja"
    }]
  });

  const serializado = JSON.stringify(contexto);

  assert.doesNotMatch(serializado, /decision-secreta/);
  assert.doesNotMatch(serializado, /reporte-secreto/);
  assert.doesNotMatch(serializado, /intervencion-secreta/);
  assert.match(serializado, /Caja presionada/);
});

test("rechaza respuestas duplicadas o incompletas", () => {
  const respuestas = DEPARTAMENTOS_EXPERTOS.map(
    respuestaValida
  );

  respuestas[5] = respuestaValida("FINANZAS");

  assert.throws(
    () => validarRespuestas(respuestas),
    /JUNTA_RESPUESTAS_INCOMPLETAS/
  );
});

test("Finanzas y Ventas se objetan sobre caja", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "¿Cómo organizamos el flujo de caja para no morir?",
    decision: null,
    reportes: [],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );

  assert.ok(
    finanzas.objeciones.some((item) => /VENTAS/.test(item))
  );
  assert.ok(
    ventas.objeciones.some((item) => /FINANZAS/.test(item))
  );
});


test("interpreta una venta humana concreta y la cruza con ticket real", async () => {
  const hechos = extraerHechosHumanos(
    "pero nos podemos guiar hoy hice una venta de mas de 100 mil pesos"
  );

  assert.equal(hechos.length, 1);
  assert.equal(hechos[0].tipo, "VENTA_REPORTADA");
  assert.equal(hechos[0].monto_cop, 100000);
  assert.equal(hechos[0].comparador, "MAYOR_QUE");
  assert.equal(hechos[0].momento, "HOY");

  const resultado = await generarRespuestasExpertas({
    pregunta:
      "pero nos podemos guiar hoy hice una venta de mas de 100 mil pesos",
    decision: null,
    reportes: [
      {
        neurona: "VENTAS",
        kpi_principal: {
          nombre: "ticket_promedio",
          valor_actual: 17141.43,
          valor_objetivo: null,
          estado: "ALERTA"
        },
        hallazgos: []
      },
      {
        neurona: "FINANZAS",
        kpi_principal: {
          nombre: "margen_bruto_confiable",
          valor_actual: null,
          valor_objetivo: null,
          estado: "ALERTA"
        },
        hallazgos: [
          {
            evidencia:
              "7 venta(s) no tienen costo congelado confiable.",
            confianza: 100
          }
        ]
      }
    ],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );
  const gente = resultado.respuestas.find(
    (item) => item.departamento === "GENTE"
  );
  const direccion = resultado.respuestas.find(
    (item) => item.departamento === "DIRECCION"
  );

  assert.match(finanzas.respuesta, /5\.8 veces/i);
  assert.match(finanzas.respuesta, /venta, cobro y margen/i);
  assert.match(ventas.respuesta, /por qué ese cliente compró tanto/i);
  assert.match(gente.respuesta, /no me da evidencia para contratar/i);
  assert.match(direccion.respuesta, /qué hizo posible esta venta/i);

  assert.ok(
    ventas.evidencia_usada.some(
      (item) => /DATO_USUARIO/.test(item)
    )
  );
  assert.ok(
    ventas.evidencia_usada.some(
      (item) => /17\.141/.test(item)
    )
  );
});


test("interpreta gasto operativo reportado sin convertirlo en opinion generica", async () => {
  const hechos = extraerHechosHumanos(
    "hoy gaste 300 mil pesos en pollo para el restaurante"
  );

  const gasto = hechos.find(
    (item) => item.tipo === "GASTO_REPORTADO"
  );

  assert.ok(gasto);
  assert.equal(gasto.monto_cop, 300000);
  assert.equal(gasto.categoria_sugerida, "OPERACIONES");

  const resultado = await generarRespuestasExpertas({
    pregunta:
      "hoy gaste 300 mil pesos en pollo para el restaurante",
    reportes: [],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const operaciones = resultado.respuestas.find(
    (item) => item.departamento === "OPERACIONES"
  );

  assert.equal(finanzas.relevancia, "ALTA");
  assert.match(finanzas.respuesta, /300\.000/);
  assert.match(operaciones.respuesta, /proveedor|insumos/i);
});

test("interpreta salida de dos empleados y evita opinion artificial de Marketing", async () => {
  const hechos = extraerHechosHumanos(
    "hoy se me fueron dos empleados"
  );

  const salida = hechos.find(
    (item) =>
      item.tipo === "SALIDA_PERSONAL_REPORTADA"
  );

  assert.ok(salida);
  assert.equal(salida.cantidad, 2);

  const resultado = await generarRespuestasExpertas({
    pregunta: "hoy se me fueron dos empleados",
    reportes: [],
    intervenciones: []
  });

  const gente = resultado.respuestas.find(
    (item) => item.departamento === "GENTE"
  );
  const marketing = resultado.respuestas.find(
    (item) => item.departamento === "MARKETING"
  );

  assert.equal(gente.relevancia, "ALTA");
  assert.match(gente.respuesta, /por qué se fueron/i);
  assert.equal(marketing.relevancia, "NINGUNA");
  assert.match(
    marketing.respuesta,
    /no veo una conclusión material/i
  );
});

test("interpreta queja de cliente como falla a reconstruir", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "hoy un cliente se quejo por la demora del pedido",
    reportes: [],
    intervenciones: []
  });

  const operaciones = resultado.respuestas.find(
    (item) => item.departamento === "OPERACIONES"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );

  assert.equal(operaciones.relevancia, "ALTA");
  assert.match(
    operaciones.respuesta,
    /reconstruir el servicio/i
  );
  assert.equal(ventas.relevancia, "MEDIA");
});

test("interpreta quiebre de inventario sin ordenar comprar mas automaticamente", async () => {
  const resultado = await generarRespuestasExpertas({
    pregunta:
      "hoy me quede sin inventario de un producto importante",
    reportes: [],
    intervenciones: []
  });

  const operaciones = resultado.respuestas.find(
    (item) => item.departamento === "OPERACIONES"
  );
  const direccion = resultado.respuestas.find(
    (item) => item.departamento === "DIRECCION"
  );

  assert.equal(operaciones.relevancia, "ALTA");
  assert.match(
    operaciones.respuesta,
    /por qué se agotó/i
  );
  assert.match(
    direccion.respuesta,
    /no ordenaría simplemente comprar más/i
  );
});

test("interpreta cambio de precio y separa margen conversion y posicionamiento", async () => {
  const hechos = extraerHechosHumanos(
    "hoy subi los precios 10%"
  );

  const cambio = hechos.find(
    (item) =>
      item.tipo === "CAMBIO_PRECIO_REPORTADO"
  );

  assert.ok(cambio);
  assert.equal(cambio.direccion, "SUBE");
  assert.equal(cambio.porcentaje, 10);

  const resultado = await generarRespuestasExpertas({
    pregunta: "hoy subi los precios 10%",
    reportes: [],
    intervenciones: []
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const ventas = resultado.respuestas.find(
    (item) => item.departamento === "VENTAS"
  );
  const marketing = resultado.respuestas.find(
    (item) => item.departamento === "MARKETING"
  );
  const gente = resultado.respuestas.find(
    (item) => item.departamento === "GENTE"
  );

  assert.equal(finanzas.relevancia, "ALTA");
  assert.match(finanzas.respuesta, /margen de contribución/i);
  assert.match(ventas.respuesta, /conversión/i);
  assert.match(marketing.respuesta, /posicionamiento/i);
  assert.equal(gente.relevancia, "NINGUNA");
});


test("mantiene el caso entre turnos y enriquece la venta con cobro cliente y canal", async () => {
  const intervenciones = [
    {
      tipo: "HUMANO",
      departamento: "DIRECCION",
      mensaje:
        "hoy hice una venta de mas de 100 mil pesos"
    },
    {
      tipo: "EXPERTO_GRUK",
      departamento: "FINANZAS",
      mensaje: "respuesta previa"
    },
    {
      tipo: "HUMANO",
      departamento: "DIRECCION",
      mensaje:
        "si, ya la cobre en efectivo; era cliente nuevo y llego por Instagram"
    }
  ];

  const hechos = extraerHechosConversacion(
    "si, ya la cobre en efectivo; era cliente nuevo y llego por Instagram",
    intervenciones
  );

  assert.equal(hechos.length, 1);
  assert.equal(hechos[0].tipo, "VENTA_REPORTADA");
  assert.equal(hechos[0].estado_cobro, "COBRADA");
  assert.equal(hechos[0].medio_pago, "EFECTIVO");
  assert.equal(hechos[0].tipo_cliente, "NUEVO");
  assert.equal(hechos[0].canal_origen, "INSTAGRAM");

  const resultado = await generarRespuestasExpertas({
    pregunta:
      "si, ya la cobre en efectivo; era cliente nuevo y llego por Instagram",
    reportes: [{
      neurona: "VENTAS",
      kpi_principal: {
        nombre: "ticket_promedio",
        valor_actual: 17141.43,
        valor_objetivo: null,
        estado: "ALERTA"
      },
      hallazgos: []
    }],
    intervenciones
  });

  const finanzas = resultado.respuestas.find(
    (item) => item.departamento === "FINANZAS"
  );
  const marketing = resultado.respuestas.find(
    (item) => item.departamento === "MARKETING"
  );
  const direccion = resultado.respuestas.find(
    (item) => item.departamento === "DIRECCION"
  );

  assert.match(
    finanzas.respuesta,
    /sí se convirtió en caja/i
  );
  assert.ok(
    !finanzas.datos_faltantes.some(
      (item) => /ya fue cobrada/i.test(item)
    )
  );

  assert.match(
    marketing.respuesta,
    /instagram/i
  );
  assert.ok(
    !marketing.datos_faltantes.some(
      (item) => /cómo conoció/i.test(item)
    )
  );

  assert.match(
    direccion.respuesta,
    /cliente nuevo/i
  );
  assert.match(
    direccion.respuesta,
    /instagram/i
  );
});
