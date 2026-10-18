"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getDeploymentCommit, verifyDeploymentCommit } = require("../../core/health/deploymentCommit.contract");
const A = "a".repeat(40);
const B = "b".repeat(40);

test("health: commit SHA válido se expone sin transformaciones", () => {
  assert.equal(getDeploymentCommit(A), A);
  assert.equal(verifyDeploymentCommit(A, A), true);
  assert.equal(verifyDeploymentCommit(A, B), false);
});

test("health: no acepta SHA parcial, mayúsculas, inyección ni entrada vacía", () => {
  for (const value of [undefined, null, "", "a".repeat(39), "a".repeat(41), A.toUpperCase(), A + "\n", { sha: A }, 123]) {
    assert.equal(getDeploymentCommit(value), null);
    assert.equal(verifyDeploymentCommit(value, A), false);
  }
});

test("health: no confirma despliegue sin SHA esperado verificable", () => {
  for (const expected of [undefined, null, "", "main", B.slice(0, 7), B.toUpperCase()]) {
    assert.equal(verifyDeploymentCommit(A, expected), false);
  }
});
