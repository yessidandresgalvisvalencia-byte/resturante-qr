"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");

test("mutaciones laborales filtran por empresa autenticada",()=>{
 const s=src("routes/laboral.js");
 assert.match(s,/empresaId:req\.auth\.empresaId/);
 assert.match(s,/findOneAndDelete/);
 assert.match(s,/findOneAndUpdate/);
});
test("socket io exige JWT compartido y canal empresarial",()=>{
 const app=src("app.js");
 const guard=src("core/auth/socketHandshake.service.js");
 assert.match(app,/io\.use/);
 assert.match(app,/await autenticarSocket\(/);
 assert.match(app,/socket\.auth\.empresaId/);
 assert.match(guard,/jwt\.verify\(/);
 assert.match(guard,/claimsValidas\(payload\)/);
});
test("socket valida revocacion y roles canonicos mediante middleware compartido",()=>{
 const guard=src("core/auth/socketHandshake.service.js");
 const claims=src("core/auth/jwtClaims.guard.js");
 assert.match(guard,/verificarSesion\(payload\)/);
 assert.match(guard,/validarVersionSesion/);
 assert.match(claims,/DUEÑO.*ADMIN_SEDE.*EMPLEADO/);
});
