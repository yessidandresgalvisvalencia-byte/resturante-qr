"use strict";
const crypto = require("crypto");

// Webhook signature paths must resolve exclusively through payload-owned fields.
// Never sign inherited values or traverse prototype-related keys.
function leerRuta(obj, ruta) {
  if (typeof ruta !== "string" || !ruta || ruta.length > 256) return undefined;
  const partes = ruta.split(".");
  if (partes.some(k => !k || k === "__proto__" || k === "prototype" || k === "constructor")) return undefined;
  let valor = obj;
  for (const clave of partes) {
    if (valor === null || typeof valor !== "object" || !Object.prototype.hasOwnProperty.call(valor, clave)) return undefined;
    valor = valor[clave];
  }
  return valor;
}
function validarEventoWompi(body, headerChecksum, secreto) {
  if (typeof secreto !== "string" || !secreto) return false;
  const props = body?.signature?.properties;
  const suppliedChecksum = headerChecksum || body?.signature?.checksum;
  if (typeof suppliedChecksum !== "string") return false;
  const checksum = suppliedChecksum.toLowerCase();
  if (!Array.isArray(props) || !props.length || props.length > 32 || !/^[a-f0-9]{64}$/.test(checksum) ||
      !(typeof body?.timestamp === "string" || (typeof body?.timestamp === "number" && Number.isFinite(body.timestamp))) ||
      String(body.timestamp).length > 32) return false;
  let cadena = "";
  for (const prop of props) {
    const valor = leerRuta(body?.data, prop);
    if (valor === undefined || valor === null || (typeof valor !== "string" && typeof valor !== "number" && typeof valor !== "boolean") ||
        (typeof valor === "number" && !Number.isFinite(valor))) return false;
    cadena += String(valor);
  }
  cadena += String(body.timestamp) + secreto;
  const esperado = crypto.createHash("sha256").update(cadena).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(checksum, "hex"), Buffer.from(esperado, "hex"));
}
module.exports = { validarEventoWompi };
