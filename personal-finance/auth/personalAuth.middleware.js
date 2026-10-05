"use strict";
const jwt = require("jsonwebtoken");
const { validarVersionSesion } = require("../../core/auth/sessionVersion.service");

async function personalAuth(req, res, next) {
  try {
    const raw = String(req.headers.authorization || "").trim();
    if (!raw.startsWith("Bearer ")) return res.status(401).json({ ok:false, error:"Autenticación personal requerida" });
    const token = raw.slice(7).trim();
    if (!token || !process.env.JWT_SECRET) return res.status(401).json({ ok:false, error:"Sesión personal inválida" });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms:["HS256"] });
    if (!payload.sub || !payload.identityType) return res.status(401).json({ ok:false, error:"Identidad personal inválida" });
    if (!["ADMIN","PERSONAL","RESTAURANTE"].includes(String(payload.identityType))) {
      return res.status(403).json({ ok:false, error:"Identidad no autorizada para Finanzas Personales" });
    }
    if (!(await validarVersionSesion(payload))) return res.status(401).json({ ok:false, error:"Sesión revocada" });
    req.personalAuth = Object.freeze({
      ownerKey: `${String(payload.identityType)}:${String(payload.sub)}`,
      subject: String(payload.sub),
      identityType: String(payload.identityType),
      tokenVersion: Number(payload.tokenVersion || 0)
    });
    next();
  } catch (error) {
    if (["JsonWebTokenError","TokenExpiredError","NotBeforeError"].includes(error?.name)) {
      return res.status(401).json({ ok:false, error:"Sesión personal inválida o expirada" });
    }
    console.error("[PERSONAL_AUTH]", error);
    return res.status(500).json({ ok:false, error:"Error interno de autenticación personal" });
  }
}
module.exports = personalAuth;
