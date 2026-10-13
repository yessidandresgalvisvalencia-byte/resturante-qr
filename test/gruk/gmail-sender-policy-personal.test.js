"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {remitenteVerificado}=require("../../modules/finanzas-personales/services/gmailSenderPolicyPersonal.service");
test("rechaza dominio parecido y DMARC ausente o desalineado",()=>{
 const ok={from:"Alertas <alertas@bancolombia.com.co>","authentication-results":"mx.google.com; dkim=pass header.d=bancolombia.com.co; dmarc=pass (p=reject) header.from=bancolombia.com.co"};
 assert.equal(remitenteVerificado(ok),true);
 assert.equal(remitenteVerificado({...ok,from:"Alertas <alertas@bancolombia.com.co.evil.test>"}),false);
 assert.equal(remitenteVerificado({...ok,"authentication-results":"mx.google.com; dmarc=fail header.from=bancolombia.com.co"}),false);
 assert.equal(remitenteVerificado({...ok,"authentication-results":"mx.google.com; dmarc=pass header.from=attacker.test"}),false);
 assert.equal(remitenteVerificado({...ok,from:"not-a-mailbox"}),false);
});
