"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Padre = require("../../modules/finanzas-personales/models/compromisoCuotas.model");
const Cuota = require("../../modules/finanzas-personales/models/cuotaHija.model");
const { listar } = require("../../modules/finanzas-personales/services/compromisosCuotas.service");

test("aislamiento real del servicio: A y B nunca reciben compromisos ni cuotas ajenos", async t => {
 const padres = [
  {_id: "compromiso-a", usuarioId: "cuenta-a", concepto: "Arriendo A", estado: "ACTIVA"},
  {_id: "compromiso-b", usuarioId: "cuenta-b", concepto: "Moto B", estado: "ACTIVA"}
 ];
 const cuotas = [
  {_id: "cuota-a", usuarioId: "cuenta-a", compromisoId: "compromiso-a", numero: 1},
  {_id: "cuota-b", usuarioId: "cuenta-b", compromisoId: "compromiso-b", numero: 1}
 ];
 const filtros = [];
 t.mock.method(Padre, "find", filtro => {
  filtros.push({coleccion: "compromisos", filtro});
  return {sort: () => ({lean: async () => padres.filter(p => p.usuarioId === filtro.usuarioId)})};
 });
 t.mock.method(Cuota, "find", filtro => {
  filtros.push({coleccion: "cuotas", filtro});
  return {sort: () => ({lean: async () => cuotas.filter(c =>
   c.usuarioId === filtro.usuarioId && filtro.compromisoId.$in.some(id => String(id) === String(c.compromisoId))
  )})};
 });
 const [a, b] = await Promise.all([listar("cuenta-a"), listar("cuenta-b")]);
 assert.deepEqual(a.map(c => c.concepto), ["Arriendo A"]);
 assert.deepEqual(b.map(c => c.concepto), ["Moto B"]);
 assert.deepEqual(a[0].cuotas.map(c => c._id), ["cuota-a"]);
 assert.deepEqual(b[0].cuotas.map(c => c._id), ["cuota-b"]);
 assert.equal(filtros.length, 4);
 for (const {filtro} of filtros) assert.ok(["cuenta-a", "cuenta-b"].includes(filtro.usuarioId));
 assert.equal(filtros.filter(x => x.coleccion === "cuotas" && x.filtro.usuarioId === "cuenta-a")[0].filtro.compromisoId.$in.join(","), "compromiso-a");
 assert.equal(filtros.filter(x => x.coleccion === "cuotas" && x.filtro.usuarioId === "cuenta-b")[0].filtro.compromisoId.$in.join(","), "compromiso-b");
});
