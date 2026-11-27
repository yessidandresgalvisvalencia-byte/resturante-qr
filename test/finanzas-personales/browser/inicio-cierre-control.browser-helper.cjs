"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
module.exports=async function verificarInicioYCierre({page,usuarioId,origin,foto}){
 const control="gruk.fp.operacionesPendientes.v81:"+usuarioId,diario="gruk.fp.manual.v81:"+usuarioId;
 const referencia=()=>({id:"referencia_"+crypto.randomUUID(),tipo:"header",huella:crypto.createHash("sha256").update(crypto.randomUUID()).digest("hex")}),antesReferencia=referencia(),despuesReferencia=referencia();
 const diarioInicial=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario)),finanzasInicial=await foto();
 assert.equal(diarioInicial.entradas.every(e=>e.estado==="CONFIRMADA"),true);assert.deepEqual(JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),control)),[]);
 let posts=0,consultas=0,asesorias=0,rawTrasCommit,solicitud,referenciaPreviaAlHTTP=false;
 const contar=req=>{const u=new URL(req.url());if(u.pathname==="/api/transacciones/confirmar-intento")consultas++;if(u.pathname==="/api/consulta")asesorias++;};page.on("request",contar);
 const patron=origin+"/api/transacciones",interceptar=async route=>{
  if(route.request().method()!=="POST")return route.continue();posts++;solicitud=route.request().postDataJSON();
  const previo=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),control));assert.equal(previo.some(p=>p.id===solicitud.externalId),true);assert.deepEqual(previo.find(p=>p.id===antesReferencia.id),antesReferencia);referenciaPreviaAlHTTP=true;
  const response=await route.fetch();assert.equal(response.status(),201);assert.equal((await response.json()).ok,true);
  rawTrasCommit=JSON.stringify([...previo,despuesReferencia]);await page.evaluate(({k,v})=>sessionStorage.setItem(k,v),{k:control,v:rawTrasCommit});return route.fulfill({response});
 };
 await page.route(patron,interceptar);
 try{
  // Otra escritura después de cargar el Map: no puede sobrescribirse al iniciar.
  const externa=JSON.stringify([antesReferencia]);await page.evaluate(({k,v})=>sessionStorage.setItem(k,v),{k:control,v:externa});
  await page.locator("#mMonto").fill("25");await page.locator("#mConcepto").fill("Ensayo conservación inicio y cierre");await page.locator("#saveMovimiento").click();await page.waitForFunction(()=>document.getElementById("movMsg").textContent.includes("No se pudo confirmar"));
  assert.equal(posts,0);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),control),externa);assert.deepEqual(await foto(),finanzasInicial);
  const pendiente=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario)).entradas.at(-1);assert.equal(pendiente.estado,"PENDIENTE");assert.equal(pendiente.body.montoMinor,25);for(const e of diarioInicial.entradas)assert.deepEqual(JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario)).entradas.find(x=>x.id===e.id),e);
  // Recarga explícita y reenvío de la misma solicitud. Se pierde solo la
  // coherencia del control, después del commit HTTP real; no se borra para reparar.
  await page.reload();await page.locator('[data-tab="movimiento"]').click();await page.getByRole("button",{name:"Consultar y reenviar el mismo movimiento",exact:true}).click();await page.waitForFunction(()=>/control original/i.test(document.getElementById("manualEstado").textContent));
  assert.equal(posts,1);assert.equal(referenciaPreviaAlHTTP,true);assert.deepEqual(solicitud,pendiente.body);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),control),rawTrasCommit);
  const sinConfirmar=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario)).entradas.find(e=>e.id===pendiente.id);assert.deepEqual(sinConfirmar,pendiente);
  const comprometida=await foto();assert.equal(comprometida.t.length,finanzasInicial.t.length+1);assert.equal(comprometida.t.filter(t=>t.concepto===solicitud.concepto&&t.montoMinor===25).length,1);for(const t of finanzasInicial.t)assert.deepEqual(comprometida.t.find(x=>String(x._id)===String(t._id)),t);
  await page.reload();await page.locator('[data-tab="movimiento"]').click();await page.getByRole("button",{name:"Consultar movimiento guardado",exact:true}).click();await page.waitForFunction(()=>!document.getElementById("manualPendientes").textContent.includes("PENDIENTE"));
  const final=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario));assert.equal(final.entradas.find(e=>e.id===pendiente.id).estado,"CONFIRMADA");assert.deepEqual(final.entradas.find(e=>e.id===pendiente.id).body,pendiente.body);for(const e of diarioInicial.entradas)assert.deepEqual(final.entradas.find(x=>x.id===e.id),e);
  assert.deepEqual(JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),control)),[antesReferencia,despuesReferencia]);assert.equal(posts,1);assert.equal(consultas,3);assert.deepEqual(await foto(),comprometida);
  await page.locator('[data-tab="gruk"]').click();await page.locator("#question").fill("¿Puedo gastar hoy?");await page.locator("#ask button").click();await page.waitForFunction(()=>document.getElementById("answer").textContent.includes("Hay operaciones financieras pendientes"));assert.equal(asesorias,0);assert.deepEqual(await foto(),comprometida);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  console.log("FP_INICIO_CIERRE_CONTROL_BROWSER",JSON.stringify({loginReal:true,Chromium390:true,conflictoInicialSinPOST:true,solicitudOriginalConservada:true,recargaYReenvioExplicitos:true,controlConservadoAntesDeHTTP:true,POSTReal:posts,commitUnico25COP:true,conflictoTras201ConservaRaizLiteral:true,diarioSiguePendienteTrasConflicto:true,GETPropioTrasRecargaConfirmaSoloSuClave:true,referenciasExternasConservadas:2,consultasPropias:consultas,asesoriaHTTP:asesorias,originalesPreviosIntactos:true,datos:"sinteticos"}));
 }finally{page.off("request",contar);await page.unroute(patron,interceptar);}
};
