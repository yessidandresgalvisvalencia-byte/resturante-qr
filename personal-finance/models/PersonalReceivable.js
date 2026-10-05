const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  ownerKey: { type: String, required: true, index: true },
  debtorName: { type: String, required: true, trim: true, maxlength: 160 },
  originalAmount: { type: Number, required: true, min: 0 },
  outstandingAmount: { type: Number, required: true, min: 0 },
  promisedAt: { type: Date, default: null },
  probability: { type: Number, min: 0, max: 1, default: 0.7 },
  status: { type: String, enum: ["PENDING","PARTIAL","COLLECTED","UNCERTAIN","WRITTEN_OFF"], default: "PENDING", index: true },
  idempotencyKey: { type: String, required: true }
}, { timestamps: true, collection: "personal_finance_receivables" });

schema.index({ ownerKey: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.models.PersonalReceivable ||
  mongoose.model("PersonalReceivable", schema);
