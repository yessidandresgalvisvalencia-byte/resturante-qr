"use strict";
// P0-70: QR is a bearer capability for ONE restaurant/table/site, not a login.
// Only authenticated staff may issue it; never log the token or put it in analytics.
const crypto = require("node:crypto");
const Restaurante = require("../../models/restaurante");
const Sede = require("../../models/sede");
const { resolvePedidoListadoScope } = require("./pedidoListadoTenant.service");
const { siteFilter } = require("../realtime/tenantRealtime.service");
const { validRestaurantId } = require("../realtime/llamadosTenant.service");
const { validMesa } = require("../realtime/llamadosCapability.service");

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

function configuredSecret(secret = process.env.GRUK_QR_MESA_SECRET) {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 32
    ? secret : null;
}
function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}
function issueToken({ empresaId, restaurantId, mesa, sedeId = "" }, {
  secret = process.env.GRUK_QR_MESA_SECRET, now = Date.now
} = {}) {
  const key = configuredSecret(secret);
  if (!key) return { status: 503, error: "Capacidades QR no configuradas" };
  if (!OBJECT_ID.test(empresaId) || !validRestaurantId(restaurantId) ||
      !validMesa(mesa) || (sedeId !== "" && !OBJECT_ID.test(sedeId)))
    return { status: 400, error: "Ámbito QR inválido" };
  const payload = Buffer.from(JSON.stringify({
    v: 1, e: empresaId.toLowerCase(), r: restaurantId,
    m: Number(mesa), s: sedeId.toLowerCase(),
    exp: Math.floor(now() / 1000) + MAX_AGE_SECONDS
  }), "utf8").toString("base64url");
  return { status: 200, token: payload + "." + sign(payload, key) };
}
function verifyToken(token, {
  secret = process.env.GRUK_QR_MESA_SECRET, now = Date.now
} = {}) {
  const key = configuredSecret(secret);
  if (!key) return { status: 503, error: "Capacidades QR no configuradas" };
  if (typeof token !== "string" || token.length > 800 ||
      !/^[A-Za-z0-9_-]{1,700}\.[A-Za-z0-9_-]{43}$/.test(token))
    return { status: 401, error: "Capacidad QR inválida" };
  const [encoded, signature] = token.split(".");
  if (!SIGNATURE.test(signature)) return { status: 401, error: "Capacidad QR inválida" };
  const expected = Buffer.from(sign(encoded, key), "ascii");
  const received = Buffer.from(signature, "ascii");
  if (expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received))
    return { status: 401, error: "Capacidad QR inválida" };
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const current = Math.floor(now() / 1000);
    if (!payload || Object.keys(payload).sort().join(",") !== "e,exp,m,r,s,v" ||
        payload.v !== 1 || !OBJECT_ID.test(payload.e) ||
        payload.e !== payload.e.toLowerCase() ||
        !validRestaurantId(payload.r) || !validMesa(payload.m) ||
        typeof payload.s !== "string" ||
        (payload.s !== "" && (!OBJECT_ID.test(payload.s) || payload.s !== payload.s.toLowerCase())) ||
        !Number.isSafeInteger(payload.exp) || payload.exp <= current ||
        payload.exp > current + MAX_AGE_SECONDS)
      return { status: 401, error: "Capacidad QR inválida o expirada" };
    return { status: 200, payload };
  } catch (_error) {
    return { status: 401, error: "Capacidad QR inválida" };
  }
}
async function issueMesaQr({ auth, restaurantId, mesa, sedeId }, {
  resolveScope = resolvePedidoListadoScope, SedeModel = Sede,
  secret = process.env.GRUK_QR_MESA_SECRET, now = Date.now
} = {}) {
  if (!validRestaurantId(restaurantId) || !validMesa(mesa) ||
      (sedeId != null && (typeof sedeId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(sedeId))))
    return { status: 400, error: "Restaurante, mesa o sede inválidos" };
  const scope = await resolveScope({ auth, restaurantId });
  if (scope.status !== 200) return { status: scope.status, error: scope.error };
  if (!OBJECT_ID.test(auth?.empresaId || ""))
    return { status: 403, error: "Empresa no verificable" };
  let canonicalSite = "";
  if (sedeId != null) {
    const filter = siteFilter(auth.empresaId, restaurantId, sedeId);
    const site = filter && await SedeModel.findOne(filter).select("_id codigoSede").lean();
    if (!site?._id) return { status: 403, error: "Sede no autorizada" };
    canonicalSite = String(site._id);
    if (!OBJECT_ID.test(canonicalSite) ||
        (scope.filter.sedeId && !scope.filter.sedeId.$in.includes(canonicalSite)))
      return { status: 403, error: "Sede no autorizada" };
  } else if (scope.filter.sedeId) {
    return { status: 403, error: "La sede es obligatoria" };
  }
  const issued = issueToken({
    empresaId: auth.empresaId, restaurantId, mesa, sedeId: canonicalSite
  }, { secret, now });
  return issued.status === 200 ? { ...issued, sedeId: canonicalSite } : issued;
}
async function resolveMesaQrRead({ restaurantId, mesa, sedeId, qrToken }, {
  RestauranteModel = Restaurante, SedeModel = Sede,
  secret = process.env.GRUK_QR_MESA_SECRET, now = Date.now
} = {}) {
  if (!validRestaurantId(restaurantId) || !validMesa(mesa))
    return { status: 400, error: "Restaurante o mesa inválidos" };
  const verified = verifyToken(qrToken, { secret, now });
  if (verified.status !== 200) return verified;
  const p = verified.payload;
  if (p.r !== restaurantId || p.m !== Number(mesa))
    return { status: 403, error: "Capacidad QR fuera de ámbito" };
  const restaurant = await RestauranteModel.findOne({
    restaurantId, empresaId: p.e
  }).select("_id").lean();
  if (!restaurant?._id) return { status: 403, error: "Restaurante no autorizado" };
  if (!p.s) {
    if (sedeId != null && sedeId !== "")
      return { status: 403, error: "Sede fuera de ámbito" };
    return { status: 200, empresaId: p.e, canonicalSedeId: p.s, filter: {
      empresaId: p.e, restaurantId, mesa: Number(mesa), sedeId: { $in: ["", null] }
    } };
  }
  const site = await SedeModel.findOne({
    _id: p.s, empresaId: p.e, restauranteId: restaurantId
  }).select("_id codigoSede").lean();
  if (!site?._id || String(site._id).toLowerCase() !== p.s)
    return { status: 403, error: "Sede no autorizada" };
  const aliases = [p.s];
  if (typeof site.codigoSede === "string" && site.codigoSede &&
      !aliases.includes(site.codigoSede)) aliases.push(site.codigoSede);
  if (sedeId != null && !aliases.includes(sedeId))
    return { status: 403, error: "Sede fuera de ámbito" };
  return { status: 200, empresaId: p.e, canonicalSedeId: p.s, filter: {
    empresaId: p.e, restaurantId, mesa: Number(mesa), sedeId: { $in: aliases }
  } };
}
module.exports = {
  issueToken, verifyToken, issueMesaQr, resolveMesaQrRead, MAX_AGE_SECONDS
};
