"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose"),S=require("../../modules/finanzas-personales/services/lecturaInversionesPersonal.service");
const oid=()=>new mongoose.Types.ObjectId(),u=oid();
const original=(o={})=>({_id:oid(),userId:u,nombre:"Fondo",clase:"FONDO",capitalAportado:100,valorActual:120,moneda:"COP",liquidezDias:null,riesgoDeclarado:"NO_CLASIFICADO",institucion:"",...o});
const copia=x=>({_id:oid(),usuarioId:u,legacyId:x._id,nombre:x.nombre,clase:x.clase,capitalAportadoMinor:x.capitalAportado,valorActualMinor:x.valorActual,moneda:x.moneda,liquidezDias:x.liquidezDias,riesgoDeclarado:x.riesgoDeclarado,institucion:x.institucion});
test("cuenta inversiones originales, vinculadas y nuevas una vez sin fabricar caja ni valor de mercado",()=>{
 const a=original(),b=original({valorActual:0}),c={...copia(a),legacyId:null};const fuente=structuredClone([a,b,c]);
 const r=S.calcular(u,[a,b],[copia(a),c]);assert.equal(r.valorInversionesMinor,240);assert.equal(r.capitalInvertidoMinor,300);assert.equal(r.resultadoInversionesMinor,-60);assert.equal(r.inversiones.length,3);assert.ok(r.inversiones.every(i=>i.valorDeclarado&&!i.valorMercadoVerificado&&!i.disponibleEnCaja));assert.deepEqual(structuredClone([a,b,c]),fuente);
 assert.deepEqual(S.calcular(u,[],[]).inversiones,[]);assert.equal(S.calcular(u,[],[]).valorInversionesMinor,0);
});
test("solo legacyId con datos coincidentes prueba identidad; mismo nombre no permite deduplicar",()=>{
 const a=original(),b=original(),c=copia(a);assert.equal(S.calcular(u,[a,b],[c]).inversiones.length,2);
 for(const k of ["nombre","clase","moneda","valorActualMinor","capitalAportadoMinor","liquidezDias","riesgoDeclarado","institucion"]){const cambiado={...c,[k]:k==="valorActualMinor"||k==="capitalAportadoMinor"||k==="liquidezDias"?5:k==="clase"?"ETF":k==="riesgoDeclarado"?"BAJO":"Distinto"};assert.throws(()=>S.calcular(u,[a],[cambiado]),e=>e.statusCode===409,k);}
 assert.throws(()=>S.calcular(u,[],[c]));assert.throws(()=>S.calcular(u,[a],[c,copia(a)]));assert.throws(()=>S.calcular(u,[a,a],[]));assert.throws(()=>S.calcular(u,[],[{...c,legacyId:null},{...c,legacyId:null}]));
});
test("rechaza importes no exactos, moneda desconocida, dueño ajeno, datos corruptos y presupuestos",()=>{
 for(const valorActual of [0.1,-1,"10",null,undefined,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>S.calcular(u,[original({valorActual})],[]),e=>e.statusCode===409);
 for(const cambio of [{moneda:"USD"},{moneda:undefined},{userId:oid()},{_id:"mal"},{nombre:""},{nombre:"x\n"},{clase:"desconocida"},{liquidezDias:0.1},{liquidezDias:-1},{riesgoDeclarado:""},{institucion:{}}])assert.throws(()=>S.calcular(u,[original(cambio)],[]),e=>e.statusCode===409);
 const max=Number.MAX_SAFE_INTEGER;assert.equal(S.calcular(u,[original({valorActual:max,capitalAportado:0})],[]).valorInversionesMinor,max);assert.throws(()=>S.calcular(u,[original({valorActual:max}),original({valorActual:1})],[]));assert.throws(()=>S.calcular(u,[original({capitalAportado:max}),original({capitalAportado:1})],[]));assert.throws(()=>S.calcular(u,Array.from({length:501},()=>original()),[]));
});
test("lectura exige sesión transaccional para no mezclar originales y copias",async()=>{await assert.rejects(S.leer(u),e=>e.statusCode===503);});
test("GET patrimonio usa dueño JWT y errores seguros sin exponer fallos internos",async()=>{
 const F=require("../../modules/finanzas-personales/services/finanzasPersonales.service"),handler=require("../../modules/finanzas-personales/routes").stack.find(x=>x.route?.path==="/patrimonio").route.stack.at(-1).handle,original=F.patrimonio,res={statusCode:200,status(n){this.statusCode=n;return this;},json(j){this.data=j;return this;}};
 try{F.patrimonio=async id=>{assert.equal(id,u);return{valorInversiones:120};};await handler({personalAuth:{userId:u},body:{usuarioId:"ajeno"}},res);assert.equal(res.data.patrimonio.valorInversiones,120);F.patrimonio=async()=>{throw Error("secreto");};await handler({personalAuth:{userId:u}},res);assert.equal(res.statusCode,500);assert.doesNotMatch(res.data.error,/secreto/);F.patrimonio=async()=>{throw Object.assign(Error("Fuentes no conciliadas"),{statusCode:409});};await handler({personalAuth:{userId:u}},res);assert.equal(res.statusCode,409);assert.equal(res.data.ok,false);}finally{F.patrimonio=original;}
});
