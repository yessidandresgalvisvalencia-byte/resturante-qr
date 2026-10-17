"use strict";
/** Offline event validation only. Authorization must be derived from verified server session. */
const TYPES = new Set(["PEDIDO_REGISTRADO", "VENTA_REGISTRADA", "INVENTARIO_AJUSTADO"]);
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EXACT_KEYS = new Set(["eventId","empresaId","sedeId","actorId","deviceId","tipo","occurredAt","schemaVersion","payload"]);
function fail(code) { const err = new Error(code); err.code = code; throw err; }
function inspectPayload(value, depth = 0) {
  if (depth > 12) fail("OFFLINE_INVALID_PAYLOAD");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 1000) fail("OFFLINE_INVALID_PAYLOAD");
    for (const v of value) inspectPayload(v, depth+1);
    return;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) fail("OFFLINE_INVALID_PAYLOAD");
  for (const [k,v] of Object.entries(value)) {
    if (k === "__proto__" || k === "prototype" || k === "constructor" || k.startsWith("$") || k.includes(".")) fail("OFFLINE_UNSAFE_KEY");
    inspectPayload(v, depth+1);
  }
}
function validateBatch(events, authenticatedContext) {
  if (!authenticatedContext || !["empresaId","sedeId","actorId"].every(k => typeof authenticatedContext[k] === "string" && ID.test(authenticatedContext[k]))) fail("OFFLINE_AUTH_REQUIRED");
  if (!Array.isArray(events) || events.length < 1 || events.length > 100) fail("OFFLINE_BATCH_SIZE");
  const seen = new Set();
  return events.map(event => {
    if (!event || typeof event !== "object" || Array.isArray(event) || Object.keys(event).some(k => !EXACT_KEYS.has(k))) fail("OFFLINE_INVALID_EVENT");
    if (!ULID.test(event.eventId) || ![event.empresaId,event.sedeId,event.actorId,event.deviceId].every(v => typeof v === "string" && ID.test(v))) fail("OFFLINE_INVALID_ID");
    if (event.empresaId !== authenticatedContext.empresaId || event.sedeId !== authenticatedContext.sedeId || event.actorId !== authenticatedContext.actorId) fail("OFFLINE_TENANT_MISMATCH");
    if (event.schemaVersion !== 1 || !TYPES.has(event.tipo)) fail("OFFLINE_INVALID_TYPE");
    if (typeof event.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(event.occurredAt) || !Number.isFinite(Date.parse(event.occurredAt))) fail("OFFLINE_INVALID_TIMESTAMP");
    if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) fail("OFFLINE_INVALID_PAYLOAD");
    inspectPayload(event.payload);
    if (Buffer.byteLength(JSON.stringify(event), "utf8") > 65536) fail("OFFLINE_PAYLOAD_TOO_LARGE");
    if (seen.has(event.eventId)) fail("OFFLINE_DUPLICATE_EVENT");
    seen.add(event.eventId);
    return Object.freeze({...event, payload: Object.freeze({...event.payload})});
  });
}
module.exports = { validateBatch };
