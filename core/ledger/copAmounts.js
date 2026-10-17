"use strict";
// Isolated COP money primitive. Values are canonical decimal strings of centavos.
// No binary floating point is used in calculations or persisted balances.
const CANON=/^(0|[1-9][0-9]*)$/;
function parseCentavos(value) {
 if (typeof value !== "string" || !CANON.test(value) || value.length>34) throw new TypeError("LEDGER_INVALID_AMOUNT");
 const n=BigInt(value);
 if (n<=0n) throw new RangeError("LEDGER_AMOUNT_MUST_BE_POSITIVE");
 return n;
}
function parseBalance(value) {
 if (typeof value !== "string" || !/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(value) || value.length>35) throw new TypeError("LEDGER_INVALID_BALANCE");
 return BigInt(value);
}
function calculateMovement({beforeCentavos,amountCentavos,tipo}) {
 const before=parseBalance(beforeCentavos);
 const amount=parseCentavos(amountCentavos);
 if (tipo!=="CREDITO" && tipo!=="DEBITO") throw new TypeError("LEDGER_INVALID_TYPE");
 const after=tipo==="CREDITO"?before+amount:before-amount;
 return Object.freeze({beforeCentavos:before.toString(),amountCentavos:amount.toString(),afterCentavos:after.toString(),tipo,currency:"COP"});
}
module.exports={calculateMovement,parseBalance,parseCentavos};
