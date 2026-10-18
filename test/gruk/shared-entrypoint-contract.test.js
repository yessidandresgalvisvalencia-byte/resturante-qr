"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname,"../..");
const server = fs.readFileSync(path.join(root,"app.js"),"utf8");
const index = fs.readFileSync(path.join(root,"public/index.html"),"utf8");

test("el arranque compartido conserva salud y readiness de la plataforma",()=>{
 assert.match(server,/app\.get\("\/ready"/);
 assert.match(server,/app\.get\("\/health"/);
 assert.match(server,/mongoose\.connection\.readyState/);
 assert.match(server,/app\.use\("\/api\/sync"/);
});

test("el arranque compartido conserva el bootstrap protegido de índices offline",()=>{
 assert.match(server,/GRUK_OFFLINE_LEDGER_INDEX_BOOTSTRAP/);
 assert.match(server,/ensureOfflineLedgerIndexes/);
});

test("el menú empresarial conserva manifest y registro del service worker",()=>{
 assert.match(index,/rel="manifest"[^>]*href="\/manifest\.json"/);
 assert.match(index,/navigator\.serviceWorker\.register\("\/service-worker\.js"\)/);
});
