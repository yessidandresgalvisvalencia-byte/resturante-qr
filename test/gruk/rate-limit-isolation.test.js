"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const rateLimit = require("../../core/security/rateLimit.middleware");

function request(limiter, ip) {
  const result = { next: false, status: null, headers: {} };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json() { return this; }
  };
  limiter({ ip }, res, () => { result.next = true; });
  return result;
}

test("limits requests for the same IP and supplies Retry-After", () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2 });
  assert.equal(request(limiter, "192.0.2.1").next, true);
  assert.equal(request(limiter, "192.0.2.1").next, true);
  const denied = request(limiter, "192.0.2.1");
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers["Retry-After"]) >= 1);
  assert.equal(request(limiter, "192.0.2.2").next, true);
});

test("separate limiter instances do not share quota", () => {
  const first = rateLimit({ max: 1 });
  const second = rateLimit({ max: 1 });
  assert.equal(request(first, "192.0.2.3").next, true);
  assert.equal(request(first, "192.0.2.3").status, 429);
  assert.equal(request(second, "192.0.2.3").next, true);
});

test("rejects invalid configurations rather than silently disabling protection", () => {
  for (const options of [{ max: 0 }, { windowMs: -1 }, { max: Infinity }, { windowMs: 1.5 }]) {
    assert.throws(() => rateLimit(options), RangeError);
  }
});
