"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const s=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Confirmación incierta se reconcilia por operacionId y nunca se reporta como rechazo definitivo",()=>{
 assert.match(s,/hasErrorLabel\?\.\("UnknownTransactionCommitResult"\)/);
 assert.match(s,/confirmed=await recuperar\(\)/);
 assert.match(s,/if\(confirmed\)return confirmed/);
 assert.match(s,/LEDGER_CONFIRMACION_INDETERMINADA/);
 assert.match(s,/indeterminado\.cause=error/);
});
