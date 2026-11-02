"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Inventario = require("../../models/Inventario");
const router = require("../../routes/inventario");

const capaAnulacion = router.stack.find((layer) => layer.route?.path === "/anular/:id");
assert.ok(capaAnulacion, "Debe existir PUT /anular/:id");
const handler = capaAnulacion.route.stack.at(-1).handle;

function respuestaSimulada() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("la anulación registra la identidad autenticada y no la enviada por el cliente", async (t) => {
  const original = Inventario.findOneAndUpdate;
  t.after(() => { Inventario.findOneAndUpdate = original; });
  let consulta;
  Inventario.findOneAndUpdate = async (...args) => {
    consulta = args;
    return { _id: "producto-1", ...args[1] };
  };
  const req = {
    params: { id: "producto-1" },
    auth: { empresaId: "empresa-1", usuarioId: "usuario-real", rol: "ADMIN_SEDE" },
    body: { motivo: "Corrección de registro", usuario: "usuario-falsificado" }
  };
  const res = respuestaSimulada();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(consulta[0]._id, "producto-1");
  assert.equal(consulta[0].empresaId, "empresa-1");
  assert.equal(consulta[1].usuarioAnulacion, "usuario-real");
  assert.equal(consulta[1].motivoAnulacion, "Corrección de registro");
});

test("la identidad autenticada se registra incluso sin usuario en el body", async (t) => {
  const original = Inventario.findOneAndUpdate;
  t.after(() => { Inventario.findOneAndUpdate = original; });
  let actualizacion;
  Inventario.findOneAndUpdate = async (_filtro, update) => {
    actualizacion = update;
    return { _id: "producto-2", ...update };
  };
  const req = {
    params: { id: "producto-2" },
    auth: { empresaId: "empresa-1", usuarioId: "usuario-real", rol: "DUEÑO" },
    body: { motivo: "Duplicado" }
  };
  const res = respuestaSimulada();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(actualizacion.usuarioAnulacion, "usuario-real");
});

test("sin motivo rechaza la anulación sin escribir inventario", async (t) => {
  const original = Inventario.findOneAndUpdate;
  t.after(() => { Inventario.findOneAndUpdate = original; });
  let escrituras = 0;
  Inventario.findOneAndUpdate = async () => { escrituras += 1; return null; };
  const req = {
    params: { id: "producto-3" },
    auth: { empresaId: "empresa-1", usuarioId: "usuario-real", rol: "ADMIN_SEDE" },
    body: { usuario: "usuario-falsificado" }
  };
  const res = respuestaSimulada();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.equal(escrituras, 0);
});
