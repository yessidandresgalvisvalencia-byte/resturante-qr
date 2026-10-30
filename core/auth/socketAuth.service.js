"use strict";
// Socket.IO must use the same signed JWT claim and revocation guards as HTTP.
// This module does not authorize room subscriptions or individual events.
const jwt = require("jsonwebtoken");
const { claimsValidas } = require("./jwtClaims.guard");
const { validarVersionSesion } = require("./sessionVersion.service");
const MAX_TOKEN_LENGTH = 8192;

function extractSocketToken(handshake) {
  const auth = handshake?.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) return null;
  const supplied = auth.token;
  // Never coerce objects or arrays into strings (e.g. "[object Object]").
  if (typeof supplied !== "string" || supplied.length > MAX_TOKEN_LENGTH) return null;
  // Keep compatibility with both existing raw JWT and "Bearer <jwt>" clients.
  const token = supplied.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) return null;
  return token;
}

async function authenticateSocketHandshake(handshake, secret, checkSession = validarVersionSesion) {
  const token = extractSocketToken(handshake);
  if (!token || typeof secret !== "string" || !secret) throw Error("UNAUTHORIZED");
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (_error) {
    throw Error("UNAUTHORIZED");
  }
  if (!claimsValidas(payload)) throw Error("UNAUTHORIZED");
  // Socket.IO connections can outlive a JWT unless the expiration is enforced after handshake.
  if (!Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000))
    throw Error("UNAUTHORIZED");
  if (!(await checkSession(payload))) throw Error("UNAUTHORIZED");
  return Object.freeze({
    usuarioId: payload.sub,
    empresaId: payload.empresaId,
    sedeId: payload.sedeId ?? null,
    restaurantId: payload.restaurantId ?? null,
    rol: payload.rol,
    identityType: payload.identityType ?? null,
    tokenVersion: payload.tokenVersion ?? 0,
    expiresAt: payload.exp
  });
}

module.exports = { extractSocketToken, authenticateSocketHandshake };
