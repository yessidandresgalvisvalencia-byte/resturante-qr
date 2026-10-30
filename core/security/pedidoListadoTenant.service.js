"use strict";
// P0-70: staff order lists and summaries must be scoped to a persisted
// restaurant and, for site-scoped users, the authenticated site.
const { resolveLlamadosScope, validRestaurantId } = require("../realtime/llamadosTenant.service");

async function resolvePedidoListadoScope({ auth, restaurantId }, {
  resolveScope = resolveLlamadosScope
} = {}) {
  if (!validRestaurantId(restaurantId))
    return { status: 400, error: "restaurantId inválido u obligatorio" };
  // Never accept empresaId or sedeId from query parameters.
  const filter = await resolveScope(auth, restaurantId);
  if (!filter || filter.restaurantId !== restaurantId ||
      Object.keys(filter).some(key => !["restaurantId", "sedeId"].includes(key)))
    return { status: 403, error: "Pedidos fuera del ámbito autorizado" };
  if (auth?.rol !== "DUEÑO" &&
      (!filter.sedeId || !Array.isArray(filter.sedeId.$in) ||
       filter.sedeId.$in.length === 0))
    return { status: 403, error: "Sede de pedidos no autorizada" };
  return { status: 200, filter };
}

module.exports = { resolvePedidoListadoScope };
