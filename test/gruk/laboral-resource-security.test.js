"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test("mutaciones laborales filtran por empresa autenticada", () => {
  const s = src("routes/laboral.js");
  assert.match(s, /empresaId:req\.auth\.empresaId/);
  assert.match(s, /findOneAndDelete/);
  assert.match(s, /findOneAndUpdate/);
});

test("socket io exige JWT y canal empresarial mediante middleware compartido", () => {
  const app = src("app.js");
  const auth = src("core/auth/socketAuth.middleware.js");
  assert.match(app, /io\.use\(createSocketAuthMiddleware\(\)\)/);
  assert.match(auth, /verifyToken\(token, process\.env\.JWT_SECRET/);
  assert.match(auth, /algorithms: \["HS256"\]/);
  assert.match(auth, /socket\.auth = Object\.freeze/);
  assert.match(app, /socket\.join\(`empresa-\$\{socket\.auth\.empresaId\}\`\)/);
});

test("socket aplica claims canonicos y revocacion igual que HTTP", () => {
  const auth = src("core/auth/socketAuth.middleware.js");
  const claims = src("core/auth/jwtClaims.guard.js");
  assert.match(auth, /claimsValidas\(payload\)/);
  assert.match(auth, /await validateSession\(payload\)/);
  assert.match(auth, /validarVersionSesion/);
  assert.match(claims, /DUEÑO.*ADMIN_SEDE.*EMPLEADO/);
});
