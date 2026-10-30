"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../public/mesero.js"), "utf8");

test("P0-70: mensajes QR no pueden inyectar HTML en panel con JWT", () => {
  const start = source.indexOf("function escapeHtml(value)");
  const end = source.indexOf("function mostrarToast", start);
  assert.ok(start >= 0 && end > start);
  const escapeHtml = new Function(source.slice(start, end) + "\nreturn escapeHtml;")();
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml("O'Hara & Co."), "O&#39;Hara &amp; Co.");
  assert.equal(escapeHtml(null), "");
  for (const expression of [
    'escapeHtml(l.mensaje || "Solicitud de mesero")',
    'escapeHtml(l.meseroNombre || "Sin asignar")',
    'escapeHtml(item.mensaje || "Solicitud de mesero")',
    'escapeHtml(item.meseroNombre || "Sin asignar")',
    'escapeHtml(p.producto)',
    'escapeHtml(nombreMesero || "este mesero")'
  ]) assert.ok(source.includes(expression), expression);
  assert.doesNotMatch(source, /\$\{l\.mensaje\}/);
  assert.doesNotMatch(source, /\$\{item\.mensaje\}/);
  assert.match(source, /\^\[a-f0-9\]\{24\}\$/i);
  assert.match(source, /const safeId = String\(l\._id\)/);
  assert.match(source, /const safePedidoId = String\(p\._id\)/);
});
