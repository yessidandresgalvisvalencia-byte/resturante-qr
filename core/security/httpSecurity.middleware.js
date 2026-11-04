"use strict";
const crypto = require("crypto");
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  const supplied = req.headers["x-request-id"];
  const requestId = typeof supplied === "string" && REQUEST_ID_PATTERN.test(supplied)
    ? supplied : crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  next();
}
function noStore(req, res, next) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
}
module.exports = { securityHeaders, noStore };
