const test = require("node:test");
const assert = require("node:assert/strict");

test("personal finance domain does not import enterprise finance models", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..", "..", "personal-finance");
  const files = [
    "personalFinance.routes.js",
    "services/personalFinance.service.js",
    "services/personalEconomicBrain.service.js"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.equal(source.includes("../core/finanzas"), false);
    assert.equal(source.includes("../models/Venta"), false);
    assert.equal(source.includes("../models/Gasto"), false);
    assert.equal(source.includes("empresaId"), false);
  }
});

test("personal finance API is mounted separately from enterprise finance API", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const app = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
  assert.match(app, /app\.use\("\/api\/finanzas", finanzasRoutes\)/);
  assert.match(app, /app\.use\("\/api\/personal-finance", personalFinanceRoutes\)/);
});
