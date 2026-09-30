const jwt = require("jsonwebtoken");
const ROLES_VALIDOS = new Set(["DUEÑO","ADMIN_SEDE","EMPLEADO"]);
const { validarVersionSesion } = require("./sessionVersion.service");

async function authMiddleware(req, res, next) {
  try {
    const authorization = String(
      req.headers.authorization || ""
    ).trim();

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "Autenticación requerida"
      });
    }

    const token = authorization
      .slice("Bearer ".length)
      .trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Token de autenticación requerido"
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error(
        "[SEGURIDAD] JWT_SECRET no está configurado"
      );

      return res.status(500).json({
        ok: false,
        error: "Configuración de seguridad inválida"
      });
    }

    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"]
    });

    if (!payload.sub || !payload.empresaId || !payload.rol || !ROLES_VALIDOS.has(String(payload.rol))) {
      return res.status(401).json({
        ok: false,
        error: "Token de autenticación inválido"
      });
    }

    if (!(await validarVersionSesion(payload))) {
      return res.status(401).json({ ok:false, error:"Sesión revocada" });
    }

    req.auth = Object.freeze({
      usuarioId: String(payload.sub),
      empresaId: String(payload.empresaId),
      sedeId: payload.sedeId
        ? String(payload.sedeId)
        : null,
      restaurantId: payload.restaurantId
        ? String(payload.restaurantId)
        : null,
      rol: String(payload.rol),
      identityType: payload.identityType ? String(payload.identityType) : null,
      tokenVersion: Number(payload.tokenVersion || 0)
    });

    return next();

  } catch (error) {
    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError" ||
      error?.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        ok: false,
        error: "Sesión inválida o expirada"
      });
    }

    console.error(
      "[SEGURIDAD] Error validando autenticación:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Error interno de autenticación"
    });
  }
}

module.exports = authMiddleware;