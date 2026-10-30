"use strict";
// P0-70: operational calls are private to the persisted restaurant and site.
// A URL, request body or client-side waiter name never grants tenant access.
const Restaurante = require("../../models/restaurante");
const Sede = require("../../models/sede");
const { siteFilter } = require("./tenantRealtime.service");

const RESTAURANT_ID = /^[A-Za-z0-9_-]{1,120}$/;
const TENANT_ID = /^[A-Za-z0-9_-]{1,80}$/;

function validRestaurantId(value) {
  return typeof value === "string" && RESTAURANT_ID.test(value);
}

async function resolveLlamadosScope(auth, restaurantId, {
  RestauranteModel = Restaurante, SedeModel = Sede
} = {}) {
  if (!validRestaurantId(restaurantId) || !auth ||
      typeof auth.empresaId !== "string" || !TENANT_ID.test(auth.empresaId) ||
      !["DUEÑO", "ADMIN_SEDE", "EMPLEADO"].includes(auth.rol) ||
      (auth.restaurantId != null && auth.restaurantId !== restaurantId)) return null;

  const restaurant = await RestauranteModel.findOne({
    restaurantId, empresaId: auth.empresaId
  }).select("_id").lean();
  if (!restaurant) return null;

  if (auth.rol === "DUEÑO" && auth.sedeId == null) return { restaurantId };
  if (!["ADMIN_SEDE", "EMPLEADO"].includes(auth.rol) ||
      auth.restaurantId !== restaurantId ||
      typeof auth.sedeId !== "string" || !TENANT_ID.test(auth.sedeId)) return null;

  const filter = siteFilter(auth.empresaId, restaurantId, auth.sedeId);
  if (!filter) return null;
  const site = await SedeModel.findOne(filter).select("_id codigoSede").lean();
  if (!site?._id) return null;

  const ids = [String(site._id)];
  if (typeof site.codigoSede === "string" &&
      site.codigoSede && !ids.includes(site.codigoSede)) ids.push(site.codigoSede);
  return { restaurantId, sedeId: { $in: ids } };
}

module.exports = { resolveLlamadosScope, validRestaurantId };
