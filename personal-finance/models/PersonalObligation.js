const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  ownerKey: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: ["SURVIVAL","OBLIGATION","QUALITY_OF_LIFE","PRODUCTIVE","DESTRUCTIVE"], default: "OBLIGATION" },
  originalAmount: { type: Number, required: true, min: 0 },
  outstandingAmount: { type: Number, required: true, min: 0 },
  installmentAmount: { type: Number, default: 0, min: 0 },
  dueDay: { type: Number, min: 1, max: 31, default: null },
  interestRateMonthly: { type: Number, min: 0, default: 0 },
  mandatory: { type: Boolean, default: true },
  productive: { type: Boolean, default: false },
  consequenceIfUnpaid: { type: String, default: "", maxlength: 500 },
  status: { type: String, enum: ["ACTIVE","PAID","RENEGOTIATING","CANCELLED"], default: "ACTIVE", index: true },
  idempotencyKey: { type: String, required: true }
}, { timestamps: true, collection: "personal_finance_obligations" });

schema.index({ ownerKey: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.models.PersonalObligation ||
  mongoose.model("PersonalObligation", schema);
