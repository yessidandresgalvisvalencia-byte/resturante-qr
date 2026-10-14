"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
test("pago de cuota usa transaccion atomica y asiento PAGO_DEUDA",()=>{
 assert.match(src,/async function pagarCuotaCredito/);
 assert.match(src,/session\.withTransaction/);
 assert.match(src,/tipo:"PAGO_DEUDA"/);
 assert.match(src,/externalIdHash:hash/);
});
test("no permite repetir numero de cuota ni sobregirar cuenta",()=>{
 assert.match(src,/Esta cuota ya está pagada/);
 assert.match(src,/numeroCuota!==pagos\.length\+1/);
 assert.match(src,/saldoMinor:\{\$gte:monto\}/);
});
test("cuota final nunca excede saldo pendiente",()=>assert.match(src,/Math\.min\(p\.cuotaMinor,p\.saldoMinor\)/));
test("pago historico no modifica caja actual ni inventa cuenta",()=>{
 assert.match(src,/impactoCaja:modo==="CUENTA"/);
 assert.match(src,/modo==="HISTORICO"/);
 assert.match(src,/PAGO HISTÓRICO SIN CUENTA/);
});
