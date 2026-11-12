'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { roleCheck, ROLES_GRUK } = require('../../core/auth/roleCheck.middleware');

function invoke(middleware, auth) {
  let nextCount = 0;
  let response;
  const res = {
    status(code) { response = { status: code }; return this; },
    json(body) { response.body = body; return this; }
  };
  middleware({ auth }, res, () => { nextCount += 1; });
  return { nextCount, response };
}

test('P0-08 roles are explicit and distinct', () => {
  assert.equal(new Set(Object.values(ROLES_GRUK)).size, 3);
  assert.deepEqual(Object.keys(ROLES_GRUK).sort(), ['ADMIN_SEDE', 'DUENO', 'EMPLEADO']);
});

test('P0-08 each privileged action denies other authenticated roles', () => {
  for (const allowed of Object.values(ROLES_GRUK)) {
    const middleware = roleCheck(allowed);
    for (const actual of Object.values(ROLES_GRUK)) {
      const result = invoke(middleware, { rol: actual, empresaId: 'empresa-1', sedeId: 'sede-1' });
      assert.equal(result.nextCount, Number(actual === allowed), allowed + ' / ' + actual);
      if (actual !== allowed) {
        assert.equal(result.response.status, 403);
        assert.equal(result.response.body.ok, false);
      }
    }
  }
});

test('P0-08 unauthenticated, malformed and missing role claims fail closed', () => {
  const middleware = roleCheck(ROLES_GRUK.DUENO);
  assert.equal(invoke(middleware, undefined).response.status, 401);
  for (const auth of [{}, { rol: null }, { rol: 'DUEÑO ' }, { rol: 'dueño' }, { rol: ['DUEÑO'] }, { rol: 'ADMIN_SEDE' }]) {
    const result = invoke(middleware, auth);
    assert.equal(result.nextCount, 0);
    assert.equal(result.response.status, 403);
  }
});

test('P0-08 an empty allowlist never authorizes any role', () => {
  for (const rol of Object.values(ROLES_GRUK)) {
    const result = invoke(roleCheck(), { rol });
    assert.equal(result.nextCount, 0);
    assert.equal(result.response.status, 403);
  }
});


test('P0-08 configuration cannot grant noncanonical or legacy roles', () => {
  for (const invalid of ['SUPERADMIN', 'DUEÑO ', 'dueño', '', null, undefined, 1, ['DUEÑO'], { rol: 'DUEÑO' }]) {
    const middleware = roleCheck(invalid);
    const result = invoke(middleware, { rol: invalid });
    assert.equal(result.nextCount, 0, String(invalid));
    assert.equal(result.response.status, 403);
  }
});

test('P0-08 invalid configured grants do not block explicitly permitted canonical roles', () => {
  const middleware = roleCheck('SUPERADMIN', ROLES_GRUK.ADMIN_SEDE, null);
  assert.equal(invoke(middleware, { rol: ROLES_GRUK.ADMIN_SEDE }).nextCount, 1);
  assert.equal(invoke(middleware, { rol: 'SUPERADMIN' }).response.status, 403);
  assert.equal(invoke(middleware, { rol: ROLES_GRUK.DUENO }).response.status, 403);
});
