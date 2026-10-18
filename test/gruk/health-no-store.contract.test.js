"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("GET /health y GET /ready prohíben cachear estado y commit de producción", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../core/health/httpHealth.routes.js"), "utf8");
  const entry = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  assert.match(entry, /registerHttpHealthRoutes\(app,mongoose,/);
  for (const endpoint of ["/health", "/ready"]) {
    const start = source.indexOf('app.get("' + endpoint + '"');
    assert.ok(start >= 0, endpoint + " debe existir");
    const end = source.indexOf("\n });", start);
    assert.ok(end > start, endpoint + " debe cerrar su manejador");
    const route = source.slice(start, end);
    assert.match(route, /res\.set\(["']Cache-Control["'],\s*["']no-store["']\)/);
    assert.match(route, /connected\s*\?\s*200\s*:\s*503/);
  }
});
