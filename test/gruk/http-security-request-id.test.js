"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders, noStore } = require("../../core/security/httpSecurity.middleware");

function run(middleware, headers = {}) {
  const values = {};
  let called = 0;
  middleware({ headers }, { setHeader(name, value) { values[name] = value; } }, () => { called++; });
  assert.equal(called, 1);
  return values;
}

test("preserves a valid correlation id and security headers", () => {
  const values = run(securityHeaders, { "x-request-id": "tenant-A:trace_123.4" });
  assert.equal(values["X-Request-Id"], "tenant-A:trace_123.4");
  assert.equal(values["X-Frame-Options"], "DENY");
  assert.equal(values["X-Content-Type-Options"], "nosniff");
});

test("replaces unsafe, oversized, non-string and empty correlation ids", () => {
  for (const value of ["", "bad id", "a\r\nX-Injected: yes", "x".repeat(129), ["a", "b"], { toString: () => "ok" }, 42, undefined]) {
    const actual = run(securityHeaders, { "x-request-id": value })["X-Request-Id"];
    assert.match(actual, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  }
});

test("noStore remains intact", () => {
  const values = run(noStore);
  assert.equal(values["Cache-Control"], "no-store, max-age=0");
  assert.equal(values["Pragma"], "no-cache");
});
