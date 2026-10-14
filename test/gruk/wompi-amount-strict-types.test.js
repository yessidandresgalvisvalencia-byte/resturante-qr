"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
test("Wompi exige centavos seguros sin coerción antes y dentro de ACID", () => {
 assert.match(source,/Number\.isSafeInteger\(transaction\.amount_in_cents\)/);
 assert.match(source,/Number\.isSafeInteger\(intento\.amountInCents\)/);
 assert.match(source,/transaction\.amount_in_cents === intento\.amountInCents/);
 assert.match(source,/lockedIntento\.amountInCents !== transaction\.amount_in_cents/);
 assert.doesNotMatch(source,/Number\(transaction\.amount_in_cents\)/);
});
