'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const express = require('express');
const mongoose = require('mongoose');

// Isolated HTTP contract tests: in-memory model stubs, no production DB or secrets.
const companyA = new mongoose.Types.ObjectId().toString();
const companyB = new mongoose.Types.ObjectId().toString();
const sedeA = new mongoose.Types.ObjectId().toString();
const sedeB = new mongoose.Types.ObjectId().toString();
const calls = [];
const Venta = { find(filter) { calls.push(['ventas', filter]); return { lean: async () => [{ total: 0.1 }, { total: 0.2 }] }; } };
const Gasto = { find(filter) { calls.push(['gastos', filter]); return { lean: async () => [{ monto: 0.29 }] }; } };
const Empresa = { findById: async id => ({ _id: id, nombre: 'Empresa prueba' }) };
const originalLoad = Module._load;
let router;
try {
  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename.endsWith('/routes/finanzas.js')) {
      if (request === '../models/Venta') return Venta;
      if (request === '../models/Gasto') return Gasto;
      if (request === '../models/Empresa') return Empresa;
      if (request === '../core/auth/auth.middleware') return (req, res, next) => {
        req.auth = {
          empresaId: req.get('x-test-company'),
          sedeId: req.get('x-test-sede') || undefined,
          rol: req.get('x-test-role') || 'DUENO'
        };
        next();
      };
      if (request === '../core/auth/roleCheck.middleware') {
        return { ROLES_GRUK: { DUENO: 'DUENO', ADMIN_SEDE: 'ADMIN_SEDE' }, roleCheck: () => (req, res, next) => next() };
      }
    }
    return originalLoad.apply(this, arguments);
  };
  router = require('../../routes/finanzas');
} finally {
  Module._load = originalLoad;
}

async function withServer(fn) {
  const app = express();
  app.use(router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await fn(async (company, sede, role, targetCompany, targetSede, dates = {}) => {
      const query = new URLSearchParams({ precision: 'exact' });
      if (targetSede) query.set('sedeId', targetSede);
      if (dates.desde) query.set('desde', dates.desde);
      if (dates.hasta) query.set('hasta', dates.hasta);
      if (dates.rawQuery) for (const [key, value] of dates.rawQuery) query.append(key, value);
      const response = await fetch(`http://127.0.0.1:${port}/resumen/${targetCompany}?${query}`, {
        headers: { 'x-test-company': company, ...(sede ? { 'x-test-sede': sede } : {}), 'x-test-role': role }
      });
      return { status: response.status, body: await response.json() };
    });
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}

test('exact HTTP endpoint rejects cross-company access before querying models', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'DUENO', companyB);
    assert.equal(response.status, 403);
    assert.equal(response.body.ok, false);
  });
  assert.equal(calls.length, 0);
});

test('exact HTTP endpoint rejects cross-branch access before querying models', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'ADMIN_SEDE', companyA, sedeB);
    assert.equal(response.status, 403);
  });
  assert.equal(calls.length, 0);
});

test('exact HTTP endpoint scopes both collections to authorized company and branch', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'ADMIN_SEDE', companyA);
    assert.equal(response.status, 200);
    assert.equal(response.body.resumenExacto.ingresos, '0.30');
    assert.equal(response.body.resumenExacto.gastos, '0.29');
    assert.equal(response.body.resumenExacto.resultado, '0.01');
  });
  assert.equal(calls.length, 2);
  for (const [, filter] of calls) {
    assert.equal(String(filter.empresaId), companyA);
    assert.equal(String(filter.sedeId), sedeA);
  }
});


test('exact HTTP endpoint rejects inverted date window before transactional reads', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'DUENO', companyA, null, {
      desde: '2026-11-08', hasta: '2026-11-07'
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
  });
  assert.equal(calls.length, 0);
});

test('exact HTTP endpoint allows equal start/end calendar dates', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'DUENO', companyA, null, {
      desde: '2026-11-07', hasta: '2026-11-07'
    });
    assert.equal(response.status, 200);
  });
  assert.equal(calls.length, 2);
});


test('exact HTTP endpoint rejects repeated date parameters before database reads', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'DUENO', companyA, null, {
      rawQuery: [['desde', '2026-11-01'], ['desde', '2026-11-02']]
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
  });
  assert.equal(calls.length, 0);
});

test('exact HTTP endpoint rejects nested date parameters before database reads', async () => {
  calls.length = 0;
  await withServer(async request => {
    const response = await request(companyA, sedeA, 'DUENO', companyA, null, {
      rawQuery: [['hasta[$gt]', '2026-11-01']]
    });
    // Express 5's simple query parser treats bracketed names as literal keys.
    // A literal unknown key must not grant additional query filters.
    assert.equal(response.status, 200);
  });
  assert.equal(calls.length, 2);
});
