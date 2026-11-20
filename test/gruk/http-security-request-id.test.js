"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders, noStore } = require("../../core/security/httpSecurity.middleware");

function invoke(middleware, headers = {}) {
  const output = {};
  let called = 0;
  middleware({ headers }, { setHeader(k, v) { output[k] = v; } }, () => { called++; });
  assert.equal(called, 1);
  return output;
}

test("security headers and safe upstream request ID are preserved", () => {
  const h = invoke(securityHeaders, { "x-request-id": "trace_123:span-4" });
  assert.equal(h["X-Request-Id"], "trace_123:span-4");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["X-Content-Type-Options"], "nosniff");
});

test("reject untrusted request IDs instead of reflecting them", () => {
  for (const value of ["bad\r\nInjected: yes", " ", "a".repeat(129), ["id-one", "id-two"], 123]) {
    const h = invoke(securityHeaders, { "x-request-id": value });
    assert.match(h["X-Request-Id"], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  }
});

test("sensitive responses are not cached", () => {
  const h = invoke(noStore);
  assert.equal(h["Cache-Control"], "no-store, max-age=0");
  assert.equal(h.Pragma, "no-cache");
});
