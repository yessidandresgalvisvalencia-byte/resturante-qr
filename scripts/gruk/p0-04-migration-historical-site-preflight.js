// GRUK P0-04: production legacy-sales historical provenance preflight.
// READ ONLY. Executes with existing temporary migration user, never writes.
// Emits only aggregate counters; does not expose any identifiers or PII.
'use strict';
const name = process.env.GRUK_ENTERPRISE_DB;
if (name !== 'restaurante' || process.env.GRUK_ENTERPRISE_DB_CONFIRM !== name) {
  throw new Error('Explicit restaurante confirmation required');
}
const database = db.getSiblingDB(name);
const sales = database.getCollection('ventas');
const orders = database.getCollection('pedidos');
const restaurants = database.getCollection('restaurantes');
const sites = database.getCollection('sedes');
const counts = {
  legacySales: 0, linkedOrders: 0, linkedRestaurants: 0,
  matchedEnterprise: 0, uniqueHistoricSite: 0, missingOrder: 0,
  missingRestaurant: 0, mismatchedEnterprise: 0,
  ambiguousSite: 0, siteCreatedAfterOrder: 0, otherUnsafe: 0
};
const docs = sales.find({ sedeId: { $not: { $type: 'objectId' } } },
  { _id: 1, empresaId: 1, sedeId: 1, origenId: 1, origen: 1, metadata: 1 }).toArray();
counts.legacySales = docs.length;
if (docs.length !== 16) {
  printjson({ legacySales: docs.length, readyForCorrection: false });
  throw new Error('Historical legacy sale count changed; re-audit required');
}
for (const sale of docs) {
  if (sale.sedeId !== null || !(sale.empresaId instanceof ObjectId)) {
    counts.otherUnsafe++; continue;
  }
  const orderId = sale.origenId instanceof ObjectId ? sale.origenId : null;
  if (!orderId || sale.origen !== 'restaurante') {
    counts.missingOrder++; continue;
  }
  const order = orders.findOne({ _id: orderId }, { restaurantId: 1, sedeId: 1, createdAt: 1 });
  if (!order) { counts.missingOrder++; continue; }
  counts.linkedOrders++;
  const origin = typeof order.restaurantId === 'string' ? order.restaurantId.trim() : '';
  if (!origin || (sale.metadata && sale.metadata.restaurantId &&
    sale.metadata.restaurantId !== origin)) { counts.otherUnsafe++; continue; }
  const restaurant = restaurants.findOne({ restaurantId: origin, empresaId: sale.empresaId },
    { empresaId: 1, restaurantId: 1 });
  if (!restaurant) { counts.missingRestaurant++; continue; }
  counts.linkedRestaurants++;
  if (!restaurant.empresaId.equals(sale.empresaId)) {
    counts.mismatchedEnterprise++; continue;
  }
  counts.matchedEnterprise++;
  const candidateSites = sites.find({ empresaId: sale.empresaId, restauranteId: origin },
    { _id: 1, empresaId: 1, restauranteId: 1, createdAt: 1 }).limit(2).toArray();
  if (candidateSites.length !== 1) { counts.ambiguousSite++; continue; }
  if (!(order.createdAt instanceof Date) ||
      !(candidateSites[0].createdAt instanceof Date) ||
      candidateSites[0].createdAt > order.createdAt) {
    counts.siteCreatedAfterOrder++; continue;
  }
  counts.uniqueHistoricSite++;
}
counts.readyForCorrection = counts.legacySales === 16 &&
  counts.uniqueHistoricSite === 16 &&
  counts.missingOrder === 0 && counts.missingRestaurant === 0 &&
  counts.mismatchedEnterprise === 0 && counts.ambiguousSite === 0 &&
  counts.siteCreatedAfterOrder === 0 && counts.otherUnsafe === 0;
printjson(counts);
// IMPORTANT: true only means relational evidence is consistent, NOT authorization
// for writes or a substitute for a verified independent backup.
if (!counts.readyForCorrection) throw new Error('Historical provenance cannot be certified automatically');
