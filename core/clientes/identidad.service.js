"use strict";

const crypto = require("crypto");

const HASH_VERSION = "v1";

const TIPOS_IDENTIDAD = Object.freeze([
  "DOCUMENTO",
  "CORREO",
  "TELEFONO"
]);

function obtenerSecreto() {
  const secreto = process.env.GRUK_CLIENT_IDENTITY_SECRET;

  if (!secreto || secreto.length < 32) {
    throw new Error(
      "GRUK_CLIENTE: GRUK_CLIENT_IDENTITY_SECRET debe existir y tener minimo 32 caracteres"
    );
  }

  return secreto;
}

function normalizarIdentidad(tipo, valor) {
  if (!TIPOS_IDENTIDAD.includes(tipo)) {
    throw new Error("GRUK_CLIENTE: tipo de identidad invalido");
  }

  if (typeof valor !== "string") {
    throw new Error("GRUK_CLIENTE: identidad debe ser texto");
  }

  const limpio = valor.trim();

  if (!limpio) {
    throw new Error("GRUK_CLIENTE: identidad vacia");
  }

  switch (tipo) {
    case "CORREO":
      return limpio.toLowerCase();

    case "TELEFONO": {
      const telefono = limpio.replace(/[^\d+]/g, "");
      const digitos = telefono.replace(/\D/g, "");

      if (/^3\d{9}$/.test(digitos)) {
        return `+57${digitos}`;
      }

      if (/^57(3\d{9})$/.test(digitos)) {
        return `+${digitos}`;
      }

      if (telefono.startsWith("+") && /^\+\d{8,15}$/.test(telefono)) {
        return telefono;
      }

      throw new Error("GRUK_CLIENTE: telefono invalido o ambiguo");
    }

    case "DOCUMENTO":
      return limpio
        .toUpperCase()
        .replace(/[\s.-]/g, "");

    default:
      throw new Error("GRUK_CLIENTE: tipo de identidad no soportado");
  }
}

function generarIdentidadHash({
  empresaId,
  tipo,
  valor
}) {
  if (!empresaId) {
    throw new Error("GRUK_CLIENTE: empresaId requerido");
  }

  const normalizado =
    normalizarIdentidad(tipo, valor);

  const secreto = obtenerSecreto();

  const mensaje =
    `${String(empresaId)}:${tipo}:${normalizado}`;

  return crypto
    .createHmac("sha256", secreto)
    .update(mensaje, "utf8")
    .digest("hex");
}

module.exports = {
  HASH_VERSION,
  TIPOS_IDENTIDAD,
  normalizarIdentidad,
  generarIdentidadHash
};
