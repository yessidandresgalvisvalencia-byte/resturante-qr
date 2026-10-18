"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crear } = require("../../modules/finanzas-personales/services/decisionProof.service");
const { verificarCadena } = require("../../modules/finanzas-personales/services/verificarCadenaDecision.service");

function cadena() {
  const base = {
    accion: "CONSULTAR",
    evaluacion: { autorizada: false, irreversible: false, motivos: ["CAJA_INSUFICIENTE"] },
    verdades: [{ nombre: "saldo", montoMinor: 1000 }],
    actorId: "TEST",
    corte: new Date("2026-10-17T12:00:00.000Z")
  };
  const primero = crear({ ...base, idempotencyKey: "decision-0001", version: 2, previousHash: null, secuencia: 1 });
  const segundo = crear({ ...base, idempotencyKey: "decision-0002", version: 2, previousHash: primero.hash, secuencia: 2 });
  return { registros: [primero, segundo], head: { secuencia: 2, headHash: segundo.hash } };
}

test("cadena válida coincide con su cabeza", () => {
  const { registros, head } = cadena();
  assert.deepEqual(verificarCadena(registros, head), { valida: true, codigo: "OK", secuencia: 2 });
  assert.deepEqual(verificarCadena([], { secuencia: 0, headHash: null }), { valida: true, codigo: "OK", secuencia: 0 });
});

test("detecta alteración de monto sin recalcular hash", () => {
  const { registros, head } = cadena();
  const adulterado = { ...registros[0], verdades: [{ nombre: "saldo", montoMinor: 999999 }] };
  assert.equal(verificarCadena([adulterado, registros[1]], head).codigo, "HASH_INVALIDO");
});

test("detecta eliminación, reordenamiento y ruptura de enlace", () => {
  const { registros, head } = cadena();
  assert.equal(verificarCadena([registros[1]], head).codigo, "SECUENCIA_INVALIDA");
  assert.equal(verificarCadena([registros[1], registros[0]], head).codigo, "SECUENCIA_INVALIDA");
  assert.equal(verificarCadena([{ ...registros[0] }, { ...registros[1], previousHash: null }], head).codigo, "ENLACE_ROTO");
});

test("detecta cabeza alterada o registros truncados", () => {
  const { registros, head } = cadena();
  assert.equal(verificarCadena(registros.slice(0, 1), head).codigo, "HEAD_NO_COINCIDE");
  assert.equal(verificarCadena(registros, { ...head, headHash: registros[0].hash }).codigo, "HEAD_NO_COINCIDE");
  assert.equal(verificarCadena(registros, { secuencia: 0, headHash: registros[1].hash }).codigo, "HEAD_INVALIDO");
});

test("auditoría con identidad rechaza head y registros de otra cuenta", () => {
  const { registros, head } = cadena();
  const usuario = "0123456789abcdef01234567";
  const otro = "abcdef0123456789abcdef01";
  const propios = registros.map(registro => ({ ...registro, usuarioId: usuario }));
  const headPropio = { ...head, usuarioId: usuario };
  assert.equal(verificarCadena(propios, headPropio, usuario).codigo, "OK");
  assert.equal(verificarCadena(propios, { ...headPropio, usuarioId: otro }, usuario).codigo, "PROPIETARIO_HEAD_NO_COINCIDE");
  assert.equal(verificarCadena([{ ...propios[0], usuarioId: otro }, propios[1]], headPropio, usuario).codigo, "PROPIETARIO_REGISTRO_NO_COINCIDE");
  assert.equal(verificarCadena(registros, headPropio, usuario).codigo, "PROPIETARIO_REGISTRO_NO_COINCIDE");
  assert.throws(() => verificarCadena(propios, headPropio, "usuario-malformado"), TypeError);
});
