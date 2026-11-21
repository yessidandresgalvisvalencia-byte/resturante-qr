"use strict";

const MAX_BUCKETS = 10000;

function rateLimit({ windowMs = 60000, max = 120 } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || !Number.isSafeInteger(max) || max <= 0) {
    throw new RangeError("rateLimit requires positive integer windowMs and max");
  }
  // Each limiter has its own state: unrelated routes must not share quotas.
  const buckets = new Map();
  return function limitRequests(req, res, next) {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || "unknown");
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs || now < bucket.start) {
      bucket = { start: now, count: 0 };
    }
    bucket.count += 1;
    buckets.delete(key);
    buckets.set(key, bucket);
    if (buckets.size > MAX_BUCKETS) {
      for (const [candidate, value] of buckets) {
        if (now < value.start || now - value.start >= windowMs) buckets.delete(candidate);
      }
      while (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
    }
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000))));
      return res.status(429).json({ ok: false, error: "Demasiadas solicitudes" });
    }
    return next();
  };
}

module.exports = rateLimit;
