"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname,
  "../../scripts/gruk/p0-04-money-readonly-preflight.js"), "utf8");

function audit({ env = {}, collectionNames = ["ventas"], counts = {} } = {}) {
  const operations = [];
  const printed = [];
  const process = { env: {
    GRUK_ENTERPRISE_DB: "gruk_empresarial",
    GRUK_ENTERPRISE_DB_CONFIRM: "gruk_empresarial",
    GRUK_MONEY_AUDIT_READONLY: "CONFIRMO_SOLO_LECTURA",
    ...env
  } };
  const database = {
    getCollectionNames() {
      operations.push("getCollectionNames");
      return collectionNames;
    },
    getCollection(name) {
      if (!collectionNames.includes(name)) throw Error("Unknown collection");
      return {
        aggregate(pipeline, opts) {
          operations.push({ command: "aggregate", name, pipeline, opts });
          assert.equal(pipeline.length, 3);
          assert.equal(opts.allowDiskUse, false);
          const nameField = pipeline[0].$project.valueType.$type.slice(1);
          return { toArray() {
            return [{ total: 2, missingOrNull: 0, invalidType: 0,
              nonCent: 0, outOfRange: 0, conversionFailures: 0,
              ...(counts[name + "." + nameField] || {}) }];
          } };
        }
      };
    }
  };
  const db = {
    getSiblingDB(name) {
      operations.push("getSiblingDB:" + name);
      return database;
    }
  };
  let error = null;
  try {
    vm.runInNewContext(source, {
      process, db, NumberDecimal: s => s, Set, printjson: value => printed.push(value)
    });
  } catch (e) { error = e; }
  return { operations, printed, error };
}

test("P0-04 financial preflight: audits actual monetary fields read-only without touching another database", () => {
  const result = audit({ collectionNames: [
    "ventas", "movimientos_caja", "cuentas_tesoreria",
    "transferencias_tesoreria", "compras", "gastos"
  ] });
  assert.equal(result.error, null);
  assert.equal(result.printed[0].monetaryDataReadyForDbaReview, true);
  assert.equal(result.printed[0].mode, "READ_ONLY");
  const fields = result.operations.filter(x => typeof x === "object");
  assert.equal(fields.length, 13);
  assert.ok(fields.every(x => x.command === "aggregate"));
  assert.ok(fields.every(x => !["cantidad", "clienteId", "actorId"].includes(
    x.pipeline[0].$project.valueType.$type.slice(1)
  )));
  assert.ok(fields.every(x => x.pipeline[2].$group.nonCent &&
    x.pipeline[2].$group.outOfRange && x.pipeline[2].$group.conversionFailures));
  assert.equal(result.operations[0], "getSiblingDB:gruk_empresarial");
});

test("P0-04 financial preflight: blocks any subcent or out-of-range historical monetary row", () => {
  const result = audit({ counts: { "ventas.total": { nonCent: 1 } } });
  assert.match(String(result.error?.message), /GRUK_MONEY_AUDIT_ANOMALIAS/);
  assert.equal(result.printed[0].monetaryDataReadyForDbaReview, false);
  const invalid = result.printed[0].targets.find(x =>
    x.collection === "ventas" && x.field === "total");
  assert.equal(invalid.nonCent, 1);
  assert.ok(!result.printed[0].targets.some(x => x._id || x.documentId));
});

test("P0-04 financial preflight: blocks missing required amounts but allows nullable legacy fields", () => {
  const missingRequired = audit({ counts: { "ventas.total": { missingOrNull: 1 } } });
  assert.match(String(missingRequired.error?.message), /GRUK_MONEY_AUDIT_ANOMALIAS/);
  assert.equal(missingRequired.printed[0].targets.find(x => x.field === "total").missingRequired, 1);
  const missingOptional = audit({ counts: { "ventas.costoUnitario": { missingOrNull: 1 } } });
  assert.equal(missingOptional.error, null);
  assert.equal(missingOptional.printed[0].monetaryDataReadyForDbaReview, true);
});

test("P0-04 financial preflight: rejects prohibited databases and missing exact confirmation before any read", () => {
  const variants = [
    { GRUK_ENTERPRISE_DB: "finanzas_personales", GRUK_ENTERPRISE_DB_CONFIRM: "finanzas_personales" },
    { GRUK_ENTERPRISE_DB: "blushea", GRUK_ENTERPRISE_DB_CONFIRM: "blushea" },
    { GRUK_ENTERPRISE_DB: "admin", GRUK_ENTERPRISE_DB_CONFIRM: "admin" },
    { GRUK_ENTERPRISE_DB: "gruk_empresarial", GRUK_ENTERPRISE_DB_CONFIRM: "another_db" },
    { GRUK_MONEY_AUDIT_READONLY: "no" }
  ];
  for (const env of variants) {
    const result = audit({ env });
    assert.ok(result.error, JSON.stringify(env));
    assert.equal(result.operations.length, 0);
  }
});
