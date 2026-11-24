"use strict";
// Temporary commercial policy for GRUK EMPRESARIAL ONLY.
// Restore paid mode by explicitly setting GRUK_ENTERPRISE_FREE_ACCESS=false.
// Do not reuse for customer order payments or GRUK Finanzas Personales.
function accesoEmpresarialGratis() {
  return process.env.GRUK_ENTERPRISE_FREE_ACCESS === "true";
}
function suspenderCobroSuscripcion(req,res,next) {
  if(accesoEmpresarialGratis()) return res.status(409).json({
    ok:false,code:"GRUK_EMPRESARIAL_GRATIS",
    error:"GRUK Empresarial es gratis por ahora. No se cobra suscripción."
  });
  return next();
}
module.exports={accesoEmpresarialGratis,suspenderCobroSuscripcion};
