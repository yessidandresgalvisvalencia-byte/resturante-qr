"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");

test("mutaciones laborales filtran por empresa autenticada",()=>{
  const s=src("routes/laboral.js");
  assert.match(s,/empresaId:req\.auth\.empresaId/);
  assert.match(s,/findOneAndDelete/);
  assert.match(s,/findOneAndUpdate/);
});

test("socket io exige JWT y canal empresarial",()=>{
  const app=src("app.js");
  const guard=src("core/auth/socketAuth.service.js");
  assert.match(app,/io\.use/);
  assert.match(app,/authenticateSocketHandshake\(socket\.handshake, process\.env\.JWT_SECRET\)/);
  assert.match(guard,/jwt\.verify\(token, secret/);
  assert.match(app,/socket\.auth\.empresaId/);
});

test("socket valida revocacion de sesion y roles canonicos",()=>{
  const app=src("app.js");
  const guard=src("core/auth/socketAuth.service.js");
  const claims=src("core/auth/jwtClaims.guard.js");
  assert.match(app,/authenticateSocketHandshake/);
  assert.match(guard,/claimsValidas\(payload\)/);
  assert.match(guard,/await checkSession\(payload\)/);
  assert.match(guard,/validarVersionSesion/);
  assert.match(claims,/DUEÑO.*ADMIN_SEDE.*EMPLEADO/);
});
