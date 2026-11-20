// GRUK P0-04 — atomic reversible site assignment for 16 legacy sales.
// The backup is a transactionally consistent IN-DATABASE recovery journal.
// It is NOT an independent disaster-recovery backup of the whole database.
'use strict';
if (process.env.GRUK_ENTERPRISE_DB !== 'restaurante' ||
    process.env.GRUK_ENTERPRISE_DB_CONFIRM !== 'restaurante' ||
    process.env.GRUK_P004_APPROVAL !== 'CORREGIR_16_VENTAS') {
  throw new Error('Enterprise database and explicit correction confirmation required');
}
const crypto = require('node:crypto');
const session = db.getMongo().startSession();
const database = session.getDatabase('restaurante');
const sales = database.getCollection('ventas');
const orders = database.getCollection('pedidos');
const restaurants = database.getCollection('restaurantes');
const sites = database.getCollection('sedes');
const originals = database.getCollection('gruk_p004_venta_originales');
const objectId = value => value instanceof ObjectId;
const same = (a, b) => objectId(a) && objectId(b) && a.equals(b);
const serialization = value => EJSON.stringify(value, null, 0, {relaxed:false});
const digest = value => crypto.createHash('sha256').update(serialization(value)).digest('hex');
let corrected = 0;
try {
  session.withTransaction(() => {
    // Collection is intentionally created only when the first snapshot is stored.
    // Failure of any check rolls back ALL updates and snapshots.
    const legacy = sales.find({ sedeId: null }).toArray();
    const invalid = sales.countDocuments({sedeId: {$not: {$type:'objectId'}}});
    if (legacy.length !== 16 || invalid !== 16) {
      throw new Error('Expected exactly 16 null site sales; rerun read-only audit');
    }
    // Do not overwrite earlier recovery journals: repeated invocation fails closed.
    if (originals.countDocuments({}) !== 0) {
      throw new Error('Existing recovery journal requires independent review');
    }
    const records = [];
    for (const sale of legacy) {
      if (sale.sedeId !== null || !objectId(sale.empresaId) ||
          !objectId(sale.origenId) || sale.origen !== 'restaurante') {
        throw new Error('Invalid original sale relationship');
      }
      const order = orders.findOne({_id:sale.origenId});
      if (!order || typeof order.restaurantId !== 'string' || !order.restaurantId.trim()) {
        throw new Error('Original order missing or invalid');
      }
      const restaurantId = order.restaurantId.trim();
      if (sale.metadata && sale.metadata.restaurantId &&
          sale.metadata.restaurantId !== restaurantId) {
        throw new Error('Sale metadata contradicts order');
      }
      const restaurant = restaurants.findOne({restaurantId,empresaId:sale.empresaId});
      if (!restaurant || !same(restaurant.empresaId,sale.empresaId)) {
        throw new Error('Restaurant ownership mismatch');
      }
      const candidateSites = sites.find({restauranteId:restaurantId,empresaId:sale.empresaId}).limit(2).toArray();
      if (candidateSites.length !== 1 || !same(candidateSites[0].empresaId,sale.empresaId)) {
        throw new Error('Missing or ambiguous historic site');
      }
      const chosen = candidateSites[0];
      if (!(order.createdAt instanceof Date) || !(chosen.createdAt instanceof Date) ||
          chosen.createdAt.getTime() > order.createdAt.getTime()) {
        throw new Error('Site not established at original order time');
      }
      // An explicit historical order site, when present, must match.
      if (order.sedeId != null && order.sedeId !== '' && !same(order.sedeId,chosen._id)) {
        throw new Error('Historical order site disagrees');
      }
      records.push({before:sale,siteId:chosen._id});
    }
    if (records.length !== 16) throw new Error('Incomplete legacy mapping');
    for (const item of records) {
      const before = item.before;
      const sourceHash = digest(before);
      originals.insertOne({
        _id:before._id,empresaId:before.empresaId,
        original:before,sourceHash,
        targetSedeId:item.siteId,
        operation:'GRUK-P0-04-2026-11-20',
        createdAt:new Date()
      });
      const result = sales.updateOne({
        _id:before._id,empresaId:before.empresaId,
        sedeId:null,origenId:before.origenId
      },{$set:{sedeId:item.siteId}});
      if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
        throw new Error('Concurrent modification or missing sale');
      }
      const actual = sales.findOne({_id:before._id,empresaId:before.empresaId});
      const expected = {...before,sedeId:item.siteId};
      if (!actual || serialization(actual) !== serialization(expected) ||
          digest(before) !== sourceHash) {
        throw new Error('Post-update document comparison failed');
      }
    }
    if (originals.countDocuments({operation:'GRUK-P0-04-2026-11-20'}) !== 16 ||
        sales.countDocuments({sedeId:{$not:{$type:'objectId'}}}) !== 0) {
      throw new Error('Final batch reconciliation failed');
    }
    corrected = records.length;
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  printjson({ status:'corrected', corrected, legacyRemaining:0,
    recoveryJournal:'gruk_p004_venta_originales',
    fullIndependentBackupVerified:false });
} finally {
  session.endSession();
}
