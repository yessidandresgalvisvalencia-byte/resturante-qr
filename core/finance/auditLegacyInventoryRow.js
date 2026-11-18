"use strict";

/**
 * P0-07: read-only preflight for legacy inventory rows.
 * Never round, mutate or silently migrate Number-backed money.
 * Reject unsafe or ambiguous representations before exact valuation.
 */
function auditLegacyInventoryRow(row) {
  const issues = [];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { safe: false, issues: ["ROW_INVALID"] };
  }
  for (const field of ["cantidad", "costo"]) {
    const descriptor = Object.getOwnPropertyDescriptor(row, field);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      issues.push(field.toUpperCase() + "_MISSING_OR_ACCESSOR");
      continue;
    }
    const value = descriptor.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      issues.push(field.toUpperCase() + "_INVALID");
      continue;
    }
    // Historical JS Numbers cannot prove their original decimal representation.
    // In particular unsafe integers and sub-cent prices cannot be migrated exactly.
    if (!Number.isSafeInteger(value) && Math.abs(value) >= Number.MAX_SAFE_INTEGER) {
      issues.push(field.toUpperCase() + "_UNSAFE_INTEGER");
    }
    if (field === "costo" && !Number.isSafeInteger(Math.round(value * 100))) {
      issues.push("COSTO_CENTS_UNSAFE");
    }
    if (field === "costo" && Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
      issues.push("COSTO_SUBCENT");
    }
  }
  return { safe: issues.length === 0, issues };
}

module.exports = { auditLegacyInventoryRow };
