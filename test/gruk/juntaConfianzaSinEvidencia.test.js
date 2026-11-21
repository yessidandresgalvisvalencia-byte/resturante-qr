"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  construirIntervencionNeurona
} = require("../../intelligence/board/junta.service");

function reporte(hallazgos) {
  return {
    neurona: "FINANZAS",
    kpi_principal: {
      nombre: "Caja",
      estado: "DATOS_INSUFICIENTES",
      evaluabilidad: "DATOS_INSUFICIENTES"
    },
    hallazgos
  };
}

test("Junta: sin hallazgos no inventa confianza 100", () => {
  const intervencion = construirIntervencionNeurona(reporte([]));
  assert.equal(intervencion.confianza, null);
});

test("Junta: confianzas ausentes o vacias no se convierten en cero", () => {
  const intervencion = construirIntervencionNeurona(reporte([
    { confianza: null },
    { confianza: undefined },
    { confianza: "" }
  ]));
  assert.equal(intervencion.confianza, null);
});

test("Junta: ignora valores de confianza fuera de 0 a 100", () => {
  const intervencion = construirIntervencionNeurona(reporte([
    { confianza: -5 },
    { confianza: 150 },
    { confianza: "no disponible" }
  ]));
  assert.equal(intervencion.confianza, null);
});

test("Junta: calcula el promedio solo con mediciones validas", () => {
  const intervencion = construirIntervencionNeurona(reporte([
    { confianza: 80 },
    { confianza: 100 },
    { confianza: null },
    { confianza: 150 }
  ]));
  assert.equal(intervencion.confianza, 90);
});

test("Junta: confianza cero explicita sigue siendo una medicion valida", () => {
  const intervencion = construirIntervencionNeurona(reporte([
    { confianza: 0 },
    { confianza: 100 }
  ]));
  assert.equal(intervencion.confianza, 50);
});
