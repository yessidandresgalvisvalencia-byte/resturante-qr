const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  ownerKey: { type:String, required:true, index:true },
  type: { type:String, required:true, index:true },
  aggregateType: { type:String, required:true },
  aggregateId: { type:mongoose.Schema.Types.ObjectId, required:true },
  idempotencyKey: { type:String, required:true },
  payload: { type:mongoose.Schema.Types.Mixed, default:{} },
  occurredAt: { type:Date, default:Date.now, immutable:true }
}, { timestamps:true, collection:"personal_finance_events" });
schema.index({ownerKey:1,idempotencyKey:1,type:1},{unique:true});
module.exports=mongoose.models.PersonalFinanceEvent||mongoose.model("PersonalFinanceEvent",schema);
