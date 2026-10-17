"use strict";
function normalizeMongoUri(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("MONGO_URI_MISSING");
  let uri = value.trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1,-1).trim();
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error("MONGO_URI_INVALID_SCHEME");
  if (/\s/.test(uri)) throw new Error("MONGO_URI_WHITESPACE");
  return uri;
}
module.exports = { normalizeMongoUri };
