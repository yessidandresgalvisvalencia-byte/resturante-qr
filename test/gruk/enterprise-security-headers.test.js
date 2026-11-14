"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders, noStore } = require("../../core/security/httpSecurity.middleware");

function responseRecorder() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); }
  };
}

test("enterprise security headers prevent MIME sniffing, framing and referrer disclosure", () => {
  const res = responseRecorder();
  let nextCount = 0;
  securityHeaders({ headers: {} }, res, () => { nextCount++; });
  assert.equal(nextCount, 1);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.equal(res.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.match(res.headers.get("permissions-policy"), /camera=\(\)/);
  assert.match(res.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
});

test("sensitive responses explicitly prohibit browser and intermediary caching", () => {
  const res = responseRecorder();
  let nextCount = 0;
  noStore({}, res, () => { nextCount++; });
  assert.equal(nextCount, 1);
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(res.headers.get("pragma"), "no-cache");
});

test("existing request IDs remain correlated for valid identifiers", () => {
  const res = responseRecorder();
  securityHeaders({ headers: { "x-request-id": "enterprise-order-123" } }, res, () => {});
  assert.equal(res.headers.get("x-request-id"), "enterprise-order-123");
});
