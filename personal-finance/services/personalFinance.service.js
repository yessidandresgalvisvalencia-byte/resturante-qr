const mongoose = require("mongoose");
const crypto = require("crypto");
const PersonalFinancialProfile = require("../models/PersonalFinancialProfile");
const PersonalObligation = require("../models/PersonalObligation");
const PersonalReceivable = require("../models/PersonalReceivable");
const brain = require("./personalEconomicBrain.service");

function key(value) {
  return String(value || crypto.randomUUID()).trim();
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function upsertProfile(ownerKey, input) {
  return withTransaction(async (session) => {
    await PersonalFinancialProfile.updateOne(
      { ownerKey },
      { $set: {
        cashAvailable: Number(input.cashAvailable || 0),
        monthlyIncome: Number(input.monthlyIncome || 0),
        targetMonthlyIncome: Number(input.targetMonthlyIncome || 0),
        emergencyReserveTarget: Number(input.emergencyReserveTarget || 0)
      }, $setOnInsert: { ownerKey, currency: "COP", country: "CO" } },
      { upsert: true, session, runValidators: true }
    );
    return brain.analyze(ownerKey, { session });
  });
}

async function registerObligation(ownerKey, input, idempotencyKey) {
  return withTransaction(async (session) => {
    await PersonalObligation.updateOne(
      { ownerKey, idempotencyKey: key(idempotencyKey) },
      { $setOnInsert: {
        ownerKey,
        idempotencyKey: key(idempotencyKey),
        name: input.name,
        category: input.category || "OBLIGATION",
        originalAmount: Number(input.originalAmount),
        outstandingAmount: Number(input.outstandingAmount ?? input.originalAmount),
        installmentAmount: Number(input.installmentAmount || 0),
        dueDay: input.dueDay || null,
        interestRateMonthly: Number(input.interestRateMonthly || 0),
        mandatory: input.mandatory !== false,
        productive: Boolean(input.productive),
        consequenceIfUnpaid: input.consequenceIfUnpaid || ""
      }},
      { upsert: true, session, runValidators: true }
    );
    return brain.analyze(ownerKey, { session });
  });
}

async function registerReceivable(ownerKey, input, idempotencyKey) {
  return withTransaction(async (session) => {
    await PersonalReceivable.updateOne(
      { ownerKey, idempotencyKey: key(idempotencyKey) },
      { $setOnInsert: {
        ownerKey,
        idempotencyKey: key(idempotencyKey),
        debtorName: input.debtorName,
        originalAmount: Number(input.originalAmount),
        outstandingAmount: Number(input.outstandingAmount ?? input.originalAmount),
        promisedAt: input.promisedAt || null,
        probability: Number(input.probability ?? 0.7)
      }},
      { upsert: true, session, runValidators: true }
    );
    return brain.analyze(ownerKey, { session });
  });
}

module.exports = { upsertProfile, registerObligation, registerReceivable, analyze: brain.analyze };
