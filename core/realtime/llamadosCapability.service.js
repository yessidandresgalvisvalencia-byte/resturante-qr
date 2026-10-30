"use strict";
// Unforgeable, per-call capability for the public QR page. The token is shown
// once to the calling browser; only its SHA-256 digest is persisted in MongoDB.
const crypto = require("node:crypto");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
function issueCallCapability() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashCallCapability(token) };
}
function hashCallCapability(token) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
function validMesa(value) {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value > 0;
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value) &&
    Number.isSafeInteger(Number(value));
}
module.exports = { issueCallCapability, hashCallCapability, validMesa };
