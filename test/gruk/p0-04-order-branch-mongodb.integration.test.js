"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Sede = require("../../models/sede");
const { authorizeOrderBranch } = require("../../core/auth/orderBranch.guard");

// Only connect to the disposable local replica set created by GRUK CI.
// Never use MONGO_URI, production credentials, or an existing business database.
const disposableUri = process.env.TEST_MONGO_URI || "";
const safeDisposable = /^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/\?replicaSet=rs0$/.test(disposableUri);

test("P0-04 Mongo real: authorization cannot cross company or branch on legacy orders", {
  skip: !safeDisposable && "requires disposable loopback MongoDB CI replica set"
}, async () => {
  const dbName = "gruk_p004_branch_" + process.pid + "_" + crypto.randomBytes(5).toString("hex");
  const conn = await mongoose.createConnection(disposableUri, { dbName, serverSelectionTimeoutMS: 10000 }).asPromise();
  try {
    const Site = conn.model("P004BranchSite", Sede.schema, "sedes");
    const companyA = new mongoose.Types.ObjectId();
    const companyB = new mongoose.Types.ObjectId();
    const restA = "gruk-p004-rest-A";
    const siteA = await Site.create({ empresaId: companyA, restauranteId: restA, nombreSede: "A1", codigoSede: "A1-LOCAL" });
    const siteSibling = await Site.create({ empresaId: companyA, restauranteId: restA, nombreSede: "A2", codigoSede: "A2-LOCAL" });
    const siteForeign = await Site.create({ empresaId: companyB, restauranteId: "gruk-p004-rest-B", nombreSede: "B1", codigoSede: "B1-LOCAL" });
    const restaurante = { empresaId: companyA, restaurantId: restA };
    const pedido = { _id: new mongoose.Types.ObjectId(), empresaId: companyA, restaurantId: restA, sedeId: siteA.codigoSede };
    const legit = { empresaId: companyA, sedeId: siteA._id, rol: "ADMIN_SEDE" };

    const authorized = await authorizeOrderBranch({ pedido, restaurante, auth: legit, siteModel: Site });
    assert.equal(String(authorized.sedeObjectId), String(siteA._id));
    assert.equal(String(authorized.pedidoParaVenta.sedeId), String(siteA._id));
    assert.equal(pedido.sedeId, siteA.codigoSede, "legacy source order must remain unmodified");

    await assert.rejects(authorizeOrderBranch({
      pedido, restaurante, auth: { ...legit, sedeId: siteSibling._id }, siteModel: Site
    }), /PEDIDO_FUERA_SEDE/);
    await assert.rejects(authorizeOrderBranch({
      pedido, restaurante, auth: { ...legit, sedeId: siteForeign._id }, siteModel: Site
    }), /SEDE_FUERA_TENANT/);
    await assert.rejects(authorizeOrderBranch({
      pedido, restaurante, auth: { ...legit, empresaId: companyB }, siteModel: Site
    }), /PEDIDO_FUERA_TENANT/);
    await assert.rejects(authorizeOrderBranch({
      pedido: { ...pedido, empresaId: companyB }, restaurante, auth: legit, siteModel: Site
    }), /PEDIDO_FUERA_TENANT/);
    await assert.rejects(authorizeOrderBranch({
      pedido: { ...pedido, sedeId: "" }, restaurante, auth: legit, siteModel: Site
    }), /PEDIDO_SIN_SEDE/);

    const owner = await authorizeOrderBranch({
      pedido: { ...pedido, sedeId: siteSibling.codigoSede },
      restaurante, auth: { empresaId: companyA, rol: "DUEÑO", sedeId: null }, siteModel: Site
    });
    assert.equal(String(owner.sedeObjectId), String(siteSibling._id));
    assert.equal(await Site.countDocuments({}), 3, "authorization must never mutate site data");
  } finally {
    await conn.dropDatabase();
    await conn.close();
  }
});
