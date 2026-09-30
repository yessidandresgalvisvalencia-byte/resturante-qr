"use strict";const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");const src=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
test("mutaciones laborales filtran por empresa autenticada",()=>{const s=src("routes/laboral.js");assert.match(s,/empresaId:req\.auth\.empresaId/);assert.match(s,/findOneAndDelete/);assert.match(s,/findOneAndUpdate/);});
test("socket io exige JWT y canal empresarial",()=>{const s=src("app.js");assert.match(s,/io\.use/);assert.match(s,/jwt\.verify\(token, process\.env\.JWT_SECRET/);assert.match(s,/socket\.auth\.empresaId/);});

test("socket valida revocacion de sesion y roles canonicos",()=>{const s=src("app.js");assert.match(s,/validarVersionSesion/);assert.match(s,/await validarVersionSesion\(payload\)/);assert.match(s,/DUEÑO.*ADMIN_SEDE.*EMPLEADO/);});
