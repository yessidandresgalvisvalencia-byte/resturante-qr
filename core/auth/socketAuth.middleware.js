"use strict";

const jwt = require("jsonwebtoken");
const { claimsValidas } = require("./jwtClaims.guard");
const { validarVersionSesion } = require("./sessionVersion.service");

// Socket connections must enforce the same claim contract as HTTP requests.
// Dependencies may be injected by tests; production uses the real verifier
// and session-revocation service.
function createSocketAuthMiddleware({
  verifyToken = jwt.verify,
  validateSession = validarVersionSesion
} = {}) {
  return async function socketAuthMiddleware(socket, next) {
    try {
      const rawToken = socket?.handshake?.auth?.token;
      if (typeof rawToken !== "string" || !process.env.JWT_SECRET) {
        return next(new Error("UNAUTHORIZED"));
      }
      const token = rawToken.trim().replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("UNAUTHORIZED"));

      const payload = verifyToken(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"]
      });
      if (!claimsValidas(payload) || !(await validateSession(payload))) {
        return next(new Error("UNAUTHORIZED"));
      }

      socket.auth = Object.freeze({
        usuarioId: String(payload.sub),
        empresaId: String(payload.empresaId),
        sedeId: payload.sedeId ? String(payload.sedeId) : null,
        rol: String(payload.rol),
        identityType: payload.identityType ? String(payload.identityType) : null,
        tokenVersion: payload.tokenVersion === undefined ? 0 : Number(payload.tokenVersion)
      });
      return next();
    } catch (_) {
      return next(new Error("UNAUTHORIZED"));
    }
  };
}

module.exports = { createSocketAuthMiddleware };
