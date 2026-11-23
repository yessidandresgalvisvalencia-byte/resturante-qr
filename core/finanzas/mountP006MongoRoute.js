"use strict";

// Explicit, opt-in production wiring. Never infer expected cash from movements.
const authMiddleware = require("../auth/auth.middleware");
const { mountAuthenticatedP006Route } = require("./authBridgeP006");

const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
function mountP006MongoRoute(app, mongoose, options = {}) {
  if (!app || typeof app.get !== "function" || !mongoose ||
      typeof options !== "object" || options === null) {
    throw new TypeError("P006_MOUNT_INVALID");
  }
  if (options.enabled !== true) return false;
  const names = options.collectionNames;
  if (!names || !["movements", "stock", "expected"].every(key =>
    typeof names[key] === "string" && /^gruk_p006_[a-z_]+$/.test(names[key]))) {
    throw new TypeError("P006_COLLECTION_NAMES_INVALID");
  }
  if (new Set(Object.values(names)).size !== 3) throw new TypeError("P006_COLLECTION_NAMES_DUPLICATE");
  const authorizeRole = ({ role, action }) =>
    action === "gruk.p006.discrepancies.read" && role === "DUEÑO";
  const getCollections = async ({ empresaId, sedeId }) => {
    if (!ID.test(empresaId) || !ID.test(sedeId)) throw new Error("P006_SCOPE_INVALID");
    const db = mongoose.connection && mongoose.connection.db;
    if (!db) throw new Error("P006_DB_UNAVAILABLE");
    const expected = await db.collection(names.expected).findOne(
      { empresaId, sedeId },
      { projection: { _id: 0, empresaId: 1, sedeId: 1, expectedCentavos: 1 } }
    );
    if (!expected || expected.empresaId !== empresaId || expected.sedeId !== sedeId ||
        typeof expected.expectedCentavos !== "string" ||
        !/^-?(0|[1-9][0-9]{0,15})$/.test(expected.expectedCentavos)) {
      throw new Error("P006_EXPECTED_UNAVAILABLE");
    }
    return {
      expectedCentavos: expected.expectedCentavos,
      movementsCollection: db.collection(names.movements),
      stockCollection: db.collection(names.stock)
    };
  };
  mountAuthenticatedP006Route(app, authMiddleware, { authorizeRole, getCollections });
  return true;
}
module.exports = { mountP006MongoRoute };
