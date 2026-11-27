"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{spawnSync}=require("node:child_process"),S=require("../../modules/finanzas-personales/services/cuentaPorCobrarInterpretada.service"),I=require("../../modules/finanzas-personales/services/interpreteFinanciero.service"),ahora=new Date("2026-11-20T04:59:59Z");
test("nombre explícito antes/después del verbo, monto exacto y patrimonio sin ingreso",()=>{
 for(const [texto,nombre,monto] of [["Juan me debe 50 lucas","Juan",50000],["Me debe María José 50.000 COP","María José",50000],["A Érika me quedó debiendo un palo","Érika",1000000],["Ana del Río me debe $100","Ana del Río",100],["Jean-Pierre me debe 1,25 palos","Jean-Pierre",1250000]]){
  const r=S.interpretar(texto,{ahora});assert.equal(r.estado,"LISTO");assert.equal(r.contraparte,nombre);assert.equal(r.montoMinor,monto);assert.equal(r.tipo,"CUENTA_POR_COBRAR");assert.equal(r.fechaVencimiento,undefined);assert.equal(+r.fecha,+ahora);assert.match(r.razonRevision,/no es dinero recibido/);assert.equal(S.validarParaAprobar(r).origenCuentaPorCobrar,"OTRO");
 }
 assert.equal(I.interpretarSegmento("Juan me debe 50 lucas").semanticFrame.naturaleza,"PATRIMONIO");
});
test("la fecha civil completa usa Colombia incluso al cambiar de año/mes; no se infiere el día 20",()=>{
 const r=S.interpretar("Ana me debe 100 pesos y me paga el 2026-11-20",{ahora});assert.equal(r.estado,"LISTO");assert.equal(r.fechaVencimiento.toISOString(),"2026-11-20T05:00:00.000Z");
 for(const cola of ["20","2026-02-30","2026-11-18","2026-11-20T00:00:00Z","mañana","2026-12-20 o el 21"]){const x=S.interpretar("Ana me debe 100 pesos y me paga el "+cola,{ahora});assert.equal(x.estado,"REQUIERE_REVISION",cola);assert.equal(x.fechaVencimiento,undefined);}
});
test("nombres genéricos, múltiples, negación y texto inyectado requieren revisión sin identidad inventada",()=>{
 for(const prefijo of ["Alguien me debe","Ana y Juan me deben","Él me debe","No Ana me debe","Ya no me debe Ana","<img onerror=alert(1)> me debe"]){const r=S.interpretar(prefijo+" 50 lucas",{ahora});assert.equal(r.estado,"REQUIERE_REVISION",prefijo);assert.equal(r.contraparte,"Por identificar");assert.throws(()=>S.validarParaAprobar(r),e=>e.statusCode===422);}
 assert.equal(S.interpretar("Ana me debe 50 lucas por un trabajo",{ahora}).estado,"REQUIERE_REVISION");
});
test("importes sin unidad, aproximados, múltiples, negativos, fracciones y desbordamientos no se contabilizan",()=>{
 for(const texto of ["Ana me debe 50","Ana me debe -100 pesos","Ana me debe 1.2 pesos","Ana me debe 50 lucas y 10 lucas","Ana me debe 0 pesos","Ana me debe 9007199254740992 COP","Ana me debe 0.0001 lucas"]){assert.throws(()=>S.interpretar(texto,{ahora}),e=>e.statusCode===422,texto);}
 assert.equal(S.interpretar("Ana me debe aproximadamente 50 lucas",{ahora}).estado,"REQUIERE_REVISION");
 for(const [v,n] of [["0,5 palos",500000],["9007199254740991 COP",Number.MAX_SAFE_INTEGER],["1.000 COP",1000],["1,000001 palos",1000001]])assert.equal(S.importeExacto(v),n);
 for(const v of ["1,001 COP","1.001 lucas","50.000 lucas","1.000001 lucas","1e3 COP","-1 COP"])assert.throws(()=>S.importeExacto(v),e=>e.statusCode===422);
});
test("aprobación valida el original y no confunde vencimiento con fecha del hecho",()=>{
 const r=S.interpretar("Ana me debe 100 pesos",{ahora});
 for(const patch of [{montoMinor:"100"},{montoMinor:1.2},{contraparte:"Por identificar"},{fechaVencimiento:"2026-11-20"},{fechaVencimiento:new Date("2026-11-18T05:00:00Z")}])assert.throws(()=>S.validarParaAprobar({...r,...patch}),e=>e.statusCode===422);
 assert.equal(S.validarParaAprobar({...r,fechaVencimiento:new Date("2026-11-19T05:00:00Z")}).fechaVencimiento.toISOString(),"2026-11-19T05:00:00.000Z");
 assert.equal(S.interpretar("Gasté 50 lucas",{ahora}),null);
});
test("resultado temporal independiente de TZ del servidor",()=>{
 const file=require.resolve("../../modules/finanzas-personales/services/cuentaPorCobrarInterpretada.service");let previo;
 for(const TZ of ["UTC","America/Bogota","Asia/Tokyo"]){const r=spawnSync(process.execPath,["-e",`const s=require(${JSON.stringify(file)});process.stdout.write(JSON.stringify(s.interpretar('Ana me debe 100 COP y me paga el 2027-01-01',{ahora:new Date('2027-01-01T04:59:00Z')})));`],{env:{...process.env,TZ},encoding:"utf8"});assert.equal(r.status,0,r.stderr);if(previo)assert.equal(r.stdout,previo);previo=r.stdout;}
});
