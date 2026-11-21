const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  ownerKey: { type: String, required: true, unique: true, index: true, trim: true },
  currency: { type: String, default: "COP", enum: ["COP"] },
  country: { type: String, default: "CO", enum: ["CO"] },
  cashAvailable: { type: Number, default: 0, min: 0 },
  monthlyIncome: { type: Number, default: 0, min: 0 },
  targetMonthlyIncome: { type: Number, default: 0, min: 0 },
  emergencyReserveTarget: { type: Number, default: 0, min: 0 },
  version: { type: Number, default: 1, min: 1 }
}, { timestamps: true, collection: "personal_finance_profiles" });

module.exports = mongoose.models.PersonalFinancialProfile ||
  mongoose.model("PersonalFinancialProfile", schema);
