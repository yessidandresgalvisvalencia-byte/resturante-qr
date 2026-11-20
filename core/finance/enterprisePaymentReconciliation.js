'use strict';

// P0-06/P0-07: pure reconciliation of a sale against captured payments.
// No DB writes, no floating-point amounts, no automatic adjustment.
const { parseMoneyToCents } = require('./enterpriseMoney');

function reconcileSalePayments(saleCents, paymentCents) {
  const expected = parseMoneyToCents(saleCents);
  if (!Array.isArray(paymentCents)) throw new TypeError('payments must be an array');
  if (paymentCents.length > 10000) throw new RangeError('too many payments');
  let captured = 0n;
  for (const payment of paymentCents) {
    captured += parseMoneyToCents(payment);
  }
  const difference = captured - expected;
  return Object.freeze({
    expectedCents: expected.toString(),
    capturedCents: captured.toString(),
    differenceCents: difference.toString(),
    status: difference === 0n ? 'balanced' : difference < 0n ? 'shortfall' : 'overpayment'
  });
}

module.exports = { reconcileSalePayments };
