"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizarTipoNegocio,
  resolverPerfilNegocio
} = require(
  "../../core/empresa/perfilesNegocio"
);

test("restaurante activa vertical restaurante y sus capacidades", () => {
  const perfil =
    resolverPerfilNegocio(
      "Restaurante",
      8
    );

  assert.equal(
    perfil.tipo,
    "restaurante"
  );

  assert.equal(
    perfil.vertical,
    "restaurante"
  );

  assert.equal(
    perfil.modulos.restaurante,
    true
  );

  assert.equal(
    perfil.modulos.inventario,
    true
  );

  assert.equal(
    perfil.modulos.gente,
    false
  );
});

test("peluqueria no crea capacidades de restaurante", () => {
  const perfil =
    resolverPerfilNegocio(
      "Peluquería",
      3
    );

  assert.equal(
    perfil.tipo,
    "peluqueria"
  );

  assert.equal(
    perfil.vertical,
    "servicios"
  );

  assert.equal(
    perfil.modulos.restaurante,
    false
  );

  assert.equal(
    perfil.modulos.finanzas,
    true
  );
});

test("negocio arbitrario conserva su tipo y usa vertical generico", () => {
  const perfil =
    resolverPerfilNegocio(
      "Estudio de arquitectura",
      6
    );

  assert.equal(
    perfil.tipo,
    "estudio_de_arquitectura"
  );

  assert.equal(
    perfil.vertical,
    "generico"
  );

  assert.equal(
    perfil.modulos.restaurante,
    false
  );
});

test("Gente y puente laboral se activan automaticamente desde 15 empleados", () => {
  const perfil =
    resolverPerfilNegocio(
      "taller",
      15
    );

  assert.equal(
    perfil.modulos.gente,
    true
  );

  assert.equal(
    perfil.modulos.laboral,
    true
  );
});

test("normalizacion de tipo de negocio es estable y segura", () => {
  assert.equal(
    normalizarTipoNegocio(
      "  Clínica Odontológica  "
    ),
    "clinica_odontologica"
  );
});
