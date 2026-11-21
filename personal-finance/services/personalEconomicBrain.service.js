const PersonalFinancialProfile = require("../models/PersonalFinancialProfile");
const PersonalObligation = require("../models/PersonalObligation");
const PersonalReceivable = require("../models/PersonalReceivable");

function money(value) { return Math.max(0, Number(value || 0)); }

async function analyze(ownerKey, { session = null } = {}) {
  const options = session ? { session } : {};
  const [profile, obligations, receivables] = await Promise.all([
    PersonalFinancialProfile.findOne({ ownerKey }, null, options).lean(),
    PersonalObligation.find({ ownerKey, status: { $in: ["ACTIVE","RENEGOTIATING"] } }, null, options).lean(),
    PersonalReceivable.find({ ownerKey, status: { $in: ["PENDING","PARTIAL","UNCERTAIN"] } }, null, options).lean()
  ]);

  const cashAvailable = money(profile?.cashAvailable);
  const monthlyIncome = money(profile?.monthlyIncome);
  const targetMonthlyIncome = money(profile?.targetMonthlyIncome);
  const mandatoryMonthly = obligations.filter(x => x.mandatory)
    .reduce((sum, x) => sum + money(x.installmentAmount), 0);
  const receivableNominal = receivables.reduce((sum, x) => sum + money(x.outstandingAmount), 0);
  const receivableRiskAdjusted = receivables.reduce(
    (sum, x) => sum + money(x.outstandingAmount) * Number(x.probability ?? 0.7), 0
  );

  // Dinero por cobrar nunca se trata como efectivo disponible.
  const monthlyGap = Math.max(0, mandatoryMonthly - monthlyIncome);
  const incomeGrowthGap = Math.max(0, targetMonthlyIncome - monthlyIncome);

  const decisions = [];
  if (mandatoryMonthly > 0 && cashAvailable < mandatoryMonthly) {
    decisions.push({
      priority: "CRITICAL",
      type: "PROTECT_OBLIGATIONS",
      title: "Proteger obligaciones antes de comprometer dinero nuevo",
      rationale: `El efectivo disponible no cubre todas las obligaciones mensuales registradas. Faltan ${Math.max(0, mandatoryMonthly - cashAvailable)} COP si vencieran dentro del mismo ciclo.`
    });
  }
  if (receivableNominal > 0) {
    decisions.push({
      priority: "HIGH",
      type: "COLLECT_RECEIVABLES",
      title: "Cobrar saldos pendientes sin contarlos como efectivo",
      rationale: `Hay ${receivableNominal} COP pendientes por cobrar; GRUK no los suma al saldo disponible hasta su recaudo.`
    });
  }
  if (incomeGrowthGap > 0 || monthlyGap > 0) {
    decisions.push({
      priority: monthlyGap > 0 ? "CRITICAL" : "HIGH",
      type: "GROW_INCOME",
      title: "Cerrar la brecha de ingresos",
      rationale: `La brecha prioritaria de ingreso es ${Math.max(monthlyGap, incomeGrowthGap)} COP mensuales. El sistema debe buscar aumento de ingreso antes que recortes indiscriminados.`
    });
  }

  return {
    ownerKey,
    currency: "COP",
    snapshot: {
      cashAvailable,
      monthlyIncome,
      mandatoryMonthly,
      receivableNominal,
      receivableRiskAdjusted: Math.round(receivableRiskAdjusted),
      monthlyGap,
      incomeGrowthGap
    },
    decisions,
    generatedAt: new Date().toISOString()
  };
}

module.exports = { analyze };
