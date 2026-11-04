"use strict";
const crypto = require("crypto");

// Do not reflect arbitrary client-controlled bytes into response headers or logs.
// Preserve well-formed correlation IDs used by existing clients.
function safeRequestId(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    ? value
    : crypto.randomUUID();
}
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Request-Id", safeRequestId(req.headers["x-request-id"]));
  next();
}
function noStore(req, res, next) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
}
module.exports = { securityHeaders, noStore };
