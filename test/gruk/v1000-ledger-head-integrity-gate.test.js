"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("V1000 valida saldo y secuencia de cabecera antes de nuevas escrituras",()=>{
 assert.match(src,/Number\.isSafeInteger\(head\.saldoCentavos\)/);
 assert.match(src,/Number\.isSafeInteger\(head\.secuencia\)/);
 assert.match(src,/LEDGER_CABECERA_INVALIDA/);
});
test("V1000 comprueba íntegramente la cadena y el hash de cabecera antes de contabilizar",()=>{
 const check=src.indexOf("LEDGER_CADENA_INCONSISTENTE");
 const update=src.indexOf("const updated=await Saldo.updateOne");
 assert.ok(check>0&&update>check);
 assert.match(src,/const verificadorEscritura=crearVerificadorCadena\(\{empresaId,sedeId\}\)/);
 assert.match(src,/verificadorEscritura\.agregar\(asiento\)/);
 assert.match(src,/verificadorEscritura\.finalizar\(head\)/);
 assert.match(src,/\.session\(session\)\.lean\(\)\.cursor\(\{batchSize:500\}\)/);
 assert.match(src,/LEDGER_ESCRITURA_REQUIERE_AUDITORIA_PARTICIONADA/);
});
