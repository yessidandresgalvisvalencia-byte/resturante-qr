const express = require("express");
const Joi = require("joi");
const service = require("./services/personalFinance.service");
const payments = require("./services/personalPayment.service");
const personalAuth = require("./auth/personalAuth.middleware");

const router = express.Router();

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) { const e = new Error(error.message); e.status = 400; throw e; }
  return value;
}
const profileSchema = Joi.object({
  cashAvailable: Joi.number().min(0).required(),
  monthlyIncome: Joi.number().min(0).required(),
  targetMonthlyIncome: Joi.number().min(0).default(0),
  emergencyReserveTarget: Joi.number().min(0).default(0)
});
const obligationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  category: Joi.string().valid("SURVIVAL","OBLIGATION","QUALITY_OF_LIFE","PRODUCTIVE","DESTRUCTIVE").default("OBLIGATION"),
  originalAmount: Joi.number().positive().required(),
  outstandingAmount: Joi.number().min(0),
  installmentAmount: Joi.number().min(0).default(0),
  dueDay: Joi.number().integer().min(1).max(31).allow(null),
  interestRateMonthly: Joi.number().min(0).default(0),
  mandatory: Joi.boolean().default(true),
  productive: Joi.boolean().default(false),
  consequenceIfUnpaid: Joi.string().allow("").max(500)
});
const receivableSchema = Joi.object({
  debtorName: Joi.string().trim().min(2).max(160).required(),
  originalAmount: Joi.number().positive().required(),
  outstandingAmount: Joi.number().min(0),
  promisedAt: Joi.date().iso().allow(null),
  probability: Joi.number().min(0).max(1).default(0.7)
});

router.use(personalAuth);
router.use((req, res, next) => {
  req.personalOwnerKey = req.personalAuth.ownerKey;
  next();
});
router.get("/state", async (req,res,next) => {
  try { res.json({ ok:true, data: await service.analyze(req.personalOwnerKey) }); } catch(e){ next(e); }
});
router.put("/profile", async (req,res,next) => {
  try { res.json({ ok:true, data: await service.upsertProfile(req.personalOwnerKey, validate(profileSchema, req.body)) }); } catch(e){ next(e); }
});
router.post("/obligations", async (req,res,next) => {
  try {
    const idem=String(req.header("idempotency-key")||"").trim();
    if (!idem) return res.status(400).json({ok:false,error:"Idempotency-Key requerido"});
    res.status(201).json({ok:true,data:await service.registerObligation(req.personalOwnerKey,validate(obligationSchema,req.body),idem)});
  } catch(e){ next(e); }
});
router.post("/receivables", async (req,res,next) => {
  try {
    const idem=String(req.header("idempotency-key")||"").trim();
    if (!idem) return res.status(400).json({ok:false,error:"Idempotency-Key requerido"});
    res.status(201).json({ok:true,data:await service.registerReceivable(req.personalOwnerKey,validate(receivableSchema,req.body),idem)});
  } catch(e){ next(e); }
});
router.post("/obligations/:id/pay", async (req,res,next) => {
  try {
    const idem=String(req.header("idempotency-key")||"").trim();
    if (!idem) return res.status(400).json({ok:false,error:"Idempotency-Key requerido"});
    const body=validate(Joi.object({amount:Joi.number().positive().required()}),req.body);
    res.json({ok:true,data:await payments.payObligation(req.personalOwnerKey,req.params.id,body.amount,idem)});
  } catch(e){ next(e); }
});
router.post("/receivables/:id/collect", async (req,res,next) => {
  try {
    const idem=String(req.header("idempotency-key")||"").trim();
    if (!idem) return res.status(400).json({ok:false,error:"Idempotency-Key requerido"});
    const body=validate(Joi.object({amount:Joi.number().positive().required()}),req.body);
    res.json({ok:true,data:await payments.collectReceivable(req.personalOwnerKey,req.params.id,body.amount,idem)});
  } catch(e){ next(e); }
});
router.use((err,req,res,next) => {
  console.error("[PERSONAL_FINANCE]", err);
  res.status(err.status || 500).json({ok:false,error:err.status ? err.message : "Error procesando finanzas personales"});
});

module.exports = router;
