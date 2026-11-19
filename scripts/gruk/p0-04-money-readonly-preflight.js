// GRUK Empresarial — monetary-data read-only preflight (mongosh).
// No writes, migration, index creation, restores, or customer-level output.
// Usage: mongosh "$GRUK_ENTERPRISE_MONGO_URI" --quiet --file scripts/gruk/p0-04-money-readonly-preflight.js
"use strict";

const name = process.env.GRUK_ENTERPRISE_DB;
if (!name || !/^[A-Za-z][A-Za-z0-9_-]{1,62}$/.test(name)) {
  throw new Error("GRUK_ENTERPRISE_DB_INVALIDO");
}
if (/(personal|finanzas|blushea|admin|local|config|test)/i.test(name)) {
  throw new Error("GRUK_ENTERPRISE_DB_PROHIBIDA");
}
if (process.env.GRUK_ENTERPRISE_DB_CONFIRM !== name ||
    process.env.GRUK_MONEY_AUDIT_READONLY !== "CONFIRMO_SOLO_LECTURA") {
  throw new Error("GRUK_ENTERPRISE_AUDIT_CONFIRMACION_REQUERIDA");
}

// Only enterprise finance collections/declared numeric fields. The collection
// names reflect the actual Mongoose models, not guessed project databases.
const targets = [
  ["ventas", ["cantidad", "precioUnitario", "costoUnitario", "costoTotal", "utilidadBruta", "total"]],
  ["movimientos_caja", ["monto"]],
  ["cuentas_tesoreria", ["saldoInicial"]],
  ["transferencias_tesoreria", ["monto"]],
  ["compras", ["subtotal", "impuestos", "total", "saldoPendientePago"]],
  ["gastos", ["monto"]]
];
const decimal100 = NumberDecimal("100");
const maxCents = NumberDecimal("9007199254740991");
const enterprise = db.getSiblingDB(name);
const existing = new Set(enterprise.getCollectionNames());
let blocked = false;
const summary = [];

for (const [collectionName, fields] of targets) {
  if (!existing.has(collectionName)) {
    summary.push({ collection: collectionName, status: "AUSENTE", fieldsAudited: 0 });
    continue;
  }
  const col = enterprise.getCollection(collectionName);
  for (const field of fields) {
    const results = col.aggregate([
      { $project: {
        valueType: { $type: "$" + field },
        amountDecimal: { $convert: { input: "$" + field, to: "decimal", onError: null, onNull: null } }
      } },
      { $project: {
        valueType: 1,
        scaled: { $multiply: ["$amountDecimal", decimal100] }
      } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        missingOrNull: { $sum: { $cond: [{ $in: ["$valueType", ["missing", "null"]] }, 1, 0] } },
        invalidType: { $sum: { $cond: [{
          $and: [
            { $not: [{ $in: ["$valueType", ["missing", "null"]] }] },
            { $not: [{ $in: ["$valueType", ["int", "long", "double", "decimal"]] }] }
          ]
        }, 1, 0] } },
        nonCent: { $sum: { $cond: [{
          $and: [
            { $ne: ["$scaled", null] },
            { $ne: ["$scaled", { $trunc: "$scaled" }] }
          ]
        }, 1, 0] } },
        outOfRange: { $sum: { $cond: [{
          $and: [
            { $ne: ["$scaled", null] },
            { $gt: [{ $abs: "$scaled" }, maxCents] }
          ]
        }, 1, 0] } },
        conversionFailures: { $sum: { $cond: [{
          $and: [
            { $in: ["$valueType", ["int", "long", "double", "decimal"]] },
            { $eq: ["$scaled", null] }
          ]
        }, 1, 0] } }
      } }
    ], { allowDiskUse: false }).toArray();
    const counts = results[0] || {
      total: 0, missingOrNull: 0, invalidType: 0,
      nonCent: 0, outOfRange: 0, conversionFailures: 0
    };
    const anomalies = counts.invalidType + counts.nonCent +
      counts.outOfRange + counts.conversionFailures;
    if (anomalies > 0) blocked = true;
    summary.push({
      collection: collectionName, field, documents: counts.total,
      missingOrNull: counts.missingOrNull, invalidType: counts.invalidType,
      nonCent: counts.nonCent, outOfRange: counts.outOfRange,
      conversionFailures: counts.conversionFailures
    });
  }
}

printjson({
  database: name,
  mode: "READ_ONLY",
  targets: summary,
  monetaryDataReadyForDbaReview: !blocked,
  note: "A passing audit is NOT approval for a migration or production deploy."
});
if (blocked) throw new Error("GRUK_MONEY_AUDIT_ANOMALIAS_REQUIEREN_REVISION");
// No write-capable Mongo commands in this script.
