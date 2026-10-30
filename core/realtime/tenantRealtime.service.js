"use strict";
// P0-70: realtime data is never broadcast to every connected company.
const Restaurante = require("../../models/restaurante");
const Sede = require("../../models/sede");
const { validarVersionSesion } = require("../auth/sessionVersion.service");
const TENANT_ID = /^[A-Za-z0-9_-]{1,80}$/;
const RESTAURANT_ID = /^[A-Za-z0-9_-]{1,120}$/;
const PRIVATE_EVENTS = new Set([
  "pedido:nuevo", "pedido:actualizado", "llamado:nuevo", "llamado:actualizado"
]);
const MENU_EVENT = "menu:actualizado";

function validTenantId(value) {
  return typeof value === "string" && TENANT_ID.test(value);
}
function validRestaurantId(value) {
  return typeof value === "string" && RESTAURANT_ID.test(value);
}
function ownerRoom(empresaId) { return "gruk:owner:" + empresaId; }
function siteRoom(empresaId, sedeObjectId) {
  return "gruk:site:" + empresaId + ":" + sedeObjectId;
}
function menuRoom(empresaId) { return "gruk:menu:" + empresaId; }

function siteFilter(empresaId, restaurantId, sedeId) {
  if (!validTenantId(empresaId) || !validRestaurantId(restaurantId) ||
      !validTenantId(sedeId)) return null;
  const choices = [{ codigoSede: sedeId }];
  if (/^[a-f0-9]{24}$/i.test(sedeId)) choices.push({ _id: sedeId });
  return { empresaId, restauranteId: restaurantId, $or: choices };
}
async function lookupSite(SedeModel, empresaId, restaurantId, sedeId) {
  const filter = siteFilter(empresaId, restaurantId, sedeId);
  if (!filter) return null;
  const site = await SedeModel.findOne(filter).select("_id").lean();
  return site?._id ? String(site._id) : null;
}

// Recheck revocation immediately before joining rooms. A valid handshake can become
// stale while a MongoDB site lookup is pending; the periodic lifecycle check is
// not sufficient to prevent that initial unauthorized subscription.
async function authorizeRoomJoin(socket, auth, validateSession, now) {
  const expiresAtMs = auth?.expiresAt * 1000;
  if (socket?.connected === false || socket?.auth !== auth ||
      typeof auth?.usuarioId !== "string" || !auth.usuarioId ||
      !["ADMIN", "PERSONAL", "RESTAURANTE", "USUARIO"].includes(auth.identityType) ||
      !Number.isSafeInteger(auth.tokenVersion) ||
      !Number.isSafeInteger(auth.expiresAt) ||
      !Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now() ||
      typeof validateSession !== "function") return false;
  try {
    const valid = await validateSession({
      sub: auth.usuarioId, empresaId: auth.empresaId,
      sedeId: auth.sedeId, restaurantId: auth.restaurantId,
      rol: auth.rol, identityType: auth.identityType,
      tokenVersion: auth.tokenVersion
    });
    // The session, socket and JWT must still be valid after the async check.
    return valid === true && socket.connected !== false &&
      socket.auth === auth && expiresAtMs > now();
  } catch (_error) {
    return false;
  }
}

// Called only after JWT signature, claims and revocation have passed.
// Never join a company-wide private room for site-scoped users.
async function joinTenantRealtimeRooms(socket, {
  SedeModel = Sede, validateSession = validarVersionSesion, now = Date.now
} = {}) {
  const auth = socket?.auth;
  if (socket?.connected === false || !auth || !validTenantId(auth.empresaId)) return 0;
  if (auth.rol === "DUEÑO" && auth.sedeId == null) {
    if (!(await authorizeRoomJoin(socket, auth, validateSession, now))) return 0;
    socket.join(ownerRoom(auth.empresaId));
    socket.join(menuRoom(auth.empresaId));
    return 2;
  }
  if (!["ADMIN_SEDE", "EMPLEADO"].includes(auth.rol) ||
      !validRestaurantId(auth.restaurantId) ||
      !validTenantId(auth.sedeId)) return 0;
  const siteId = await lookupSite(SedeModel, auth.empresaId, auth.restaurantId, auth.sedeId);
  // A socket can disconnect while the asynchronous tenant lookup is pending.
  if (!siteId || !(await authorizeRoomJoin(socket, auth, validateSession, now))) return 0;
  socket.join(siteRoom(auth.empresaId, siteId));
  socket.join(menuRoom(auth.empresaId));
  return 2;
}

// All tenant and site scope comes from persisted DB records, never request body claims.
// Unknown or ambiguous legacy site identifiers fail closed; only owners receive
// unscoped legacy private events. Menu messages carry no private record payload.
async function emitRestaurantRealtime(io, { restaurantId, sedeId = null, event, payload },
  { RestauranteModel = Restaurante, SedeModel = Sede } = {}) {
  if (!io || typeof io.to !== "function" || !validRestaurantId(restaurantId) ||
      (event !== MENU_EVENT && !PRIVATE_EVENTS.has(event))) return false;
  try {
    const restaurant = await RestauranteModel.findOne({ restaurantId })
      .select("empresaId").lean();
    const empresaId = restaurant?.empresaId ? String(restaurant.empresaId) : null;
    if (!validTenantId(empresaId)) return false;
    if (event === MENU_EVENT) {
      io.to(menuRoom(empresaId)).emit(MENU_EVENT, { restaurantId });
      return true;
    }
    if (!payload || String(payload.restaurantId || "") !== restaurantId) return false;
    let target = io.to(ownerRoom(empresaId));
    if (sedeId !== null && sedeId !== "") {
      const siteId = await lookupSite(SedeModel, empresaId, restaurantId, sedeId);
      if (!siteId) return false;
      target = target.to(siteRoom(empresaId, siteId));
    }
    target.emit(event, payload);
    return true;
  } catch (_error) {
    // Realtime is post-commit and must not turn a persisted sale into an HTTP 500.
    return false;
  }
}

module.exports = {
  joinTenantRealtimeRooms, emitRestaurantRealtime,
  ownerRoom, siteRoom, menuRoom, siteFilter
};
