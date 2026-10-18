"use strict";
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

async function run() {
  const script = await readFile(path.join(__dirname, "../../public/js/gruk-offline-outbox.js"));
  const server = createServer((req, res) => {
    if (req.url === "/gruk-offline-outbox.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      res.end(script);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end('<!doctype html><meta charset="utf-8"><title>GRUK isolated offline test</title><script src="/gruk-offline-outbox.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/";
  const profile = await mkdtemp(path.join(os.tmpdir(), "gruk-indexeddb-e2e-"));
  const tenantA = { empresaId: "empresa-a", sedeId: "sede-a", actorId: "operador-a" };
  const tenantB = { empresaId: "empresa-b", sedeId: "sede-a", actorId: "operador-a" };
  const ids = Array.from({ length: 20 }, (_, n) => String(n + 1).padStart(26, "0"));
  let browser;
  try {
    browser = await chromium.launchPersistentContext(profile, { headless: true });
    let page = await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const first = await page.evaluate(async ({ tenant, ids }) => {
      const api = globalThis.GRUKOfflineOutbox;
      for (const eventId of ids) {
        await api.putPending({ ...tenant, eventId, payload: { items: [{ productoId: "producto-1", cantidad: 1 }] } });
      }
      return { pending: (await api.listPending(100, tenant)).length,
        reservations: (await api.listStockReservations(tenant)).length };
    }, { tenant: tenantA, ids });
    assert.deepEqual(first, { pending: 20, reservations: 20 });
    await browser.close();
    browser = null;

    // Same browser profile and origin after full browser process shutdown.
    browser = await chromium.launchPersistentContext(profile, { headless: true });
    page = await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const after = await page.evaluate(async ({ tenantA, tenantB, ids }) => {
      const api = globalThis.GRUKOfflineOutbox;
      const pending = await api.listPending(100, tenantA);
      const otherTenant = await api.listPending(100, tenantB);
      let duplicateRejected = false;
      try {
        await api.putPending({ ...tenantA, eventId: ids[0], payload: { items: [{ productoId: "producto-1", cantidad: 1 }] } });
      } catch (error) { duplicateRejected = true; }
      const countAfterDuplicate = (await api.listPending(100, tenantA)).length;
      return {
        ids: pending.map(event => event.eventId).sort(),
        otherTenant: otherTenant.length, duplicateRejected, countAfterDuplicate
      };
    }, { tenantA, tenantB, ids });
    assert.deepEqual(after.ids, ids);
    assert.equal(after.otherTenant, 0);
    assert.equal(after.duplicateRejected, true);
    assert.equal(after.countAfterDuplicate, 20);

    // Acknowledgment records must remain durable, without deleting local events.
    const received = await page.evaluate(async ({ tenant, eventId }) => {
      const api = globalThis.GRUKOfflineOutbox;
      const changed = await api.markReceived(eventId, tenant);
      return { changed, pending: (await api.listPending(100, tenant)).length,
        received: (await api.listReceived(100, tenant)).length,
        local: (await api.listLocal(100, tenant)).length };
    }, { tenant: tenantA, eventId: ids[0] });
    assert.deepEqual(received, { changed: true, pending: 19, received: 1, local: 20 });
    console.log(JSON.stringify({ result: "ok", browser: "chromium", events: 20,
      browserRestart: true, isolatedTenant: true, duplicatedEvents: 0, retainedReceived: 1 }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
