"use strict";
// P0-70: A JWT verified at handshake must not authorize a socket forever.
// Disconnect on expiration and revalidate session revocation at bounded intervals.
const { validarVersionSesion } = require("../auth/sessionVersion.service");
const RECHECK_MS = 60_000;
const MAX_TIMEOUT_MS = 2_147_483_647;

function guardRealtimeSession(socket, {
  checkSession = validarVersionSesion,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
} = {}) {
  const auth = socket?.auth;
  let stopped = false;
  let expiryTimer = null;
  let recheckTimer = null;
  let checking = false;

  function cleanup() {
    if (stopped) return;
    stopped = true;
    if (expiryTimer !== null) clearTimeoutFn(expiryTimer);
    if (recheckTimer !== null) clearIntervalFn(recheckTimer);
    socket?.off?.("disconnect", cleanup);
  }
  function disconnect() {
    if (stopped) return;
    cleanup();
    socket?.disconnect?.(true);
  }
  const expiresAtMs = auth?.expiresAt * 1000;
  if (!auth || typeof auth.usuarioId !== "string" || !auth.usuarioId ||
      typeof auth.empresaId !== "string" || !auth.empresaId ||
      !Number.isSafeInteger(auth.expiresAt) ||
      !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now() ||
      socket.connected === false) {
    disconnect();
    return cleanup;
  }

  // Revalidate against the same tokenVersion store used by HTTP authentication.
  // Never allow overlapping Mongo queries for the same socket.
  async function recheck() {
    if (stopped || checking) return;
    checking = true;
    try {
      if (expiresAtMs <= now() || !(await checkSession({
        sub: auth.usuarioId, empresaId: auth.empresaId,
        sedeId: auth.sedeId, restaurantId: auth.restaurantId,
        rol: auth.rol, identityType: auth.identityType,
        tokenVersion: auth.tokenVersion
      }))) disconnect();
    } catch (_error) {
      // A database outage is not permission to keep a private realtime channel.
      disconnect();
    } finally {
      checking = false;
    }
  }

  function scheduleExpiry() {
    if (stopped) return;
    const remaining = expiresAtMs - now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      disconnect();
      return;
    }
    expiryTimer = setTimeoutFn(scheduleExpiry, Math.min(remaining, MAX_TIMEOUT_MS));
    expiryTimer?.unref?.();
  }

  socket.once?.("disconnect", cleanup);
  scheduleExpiry();
  if (!stopped) {
    recheckTimer = setIntervalFn(recheck, RECHECK_MS);
    recheckTimer?.unref?.();
  }
  return cleanup;
}

module.exports = { guardRealtimeSession, RECHECK_MS };
