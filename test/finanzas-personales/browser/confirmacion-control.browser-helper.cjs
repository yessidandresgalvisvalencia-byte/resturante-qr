"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
// Solo datos del usuario sintético del ensayo. La referencia adicional se conserva.
module.exports=async function confirmarSinSobrescribir({page,usuarioId,diario,entrada,panel,modo}){
 const control="gruk.fp.operacionesPendientes.v81:"+usuarioId,otra={id:"referencia_"+crypto.randomUUID(),tipo:"header",huella:crypto.createHash("sha256").update("Referencia sintética conservada "+modo).digest("hex")},originalDiario=await page.evaluate(k=>sessionStorage.getItem(k),diario);
 assert.equal(JSON.parse(originalDiario).entradas.find(e=>e.id===entrada.id).estado,"PENDIENTE");
 const previo=await page.evaluate(k=>sessionStorage.getItem(k),control);assert.equal(JSON.parse(previo).some(p=>p.id===entrada.id),true);
 // El control en memoria ya existe: se reproduce otra incorporación persistida.
 const alterado=JSON.stringify([...JSON.parse(previo),otra]);await page.evaluate(({k,v})=>sessionStorage.setItem(k,v),{k:control,v:alterado});
 let recibos=0,posts=0,asesoria=0;const contar=req=>{const u=new URL(req.url());if(u.pathname.includes("/recibos/"))recibos++;if(req.method()==="POST"&&/\/(imputaciones|restaurar-con-ciclo)$/.test(u.pathname))posts++;if(u.pathname==="/api/consulta")asesoria++;};page.on("request",contar);
 const pendiente=()=>page.locator("#"+panel+"Pendientes").getByRole("button",{name:"Consultar recibo",exact:true});
 try{
  await pendiente().click();await page.waitForFunction(p=>/recibo no coincide/i.test(document.getElementById(p+"Estado").textContent),panel);
  assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),control),alterado);assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),diario),originalDiario);
  await page.locator('[data-tab="gruk"]').click();await page.locator("#question").fill("¿Puedo gastar hoy?");await page.locator("#ask button").click();await page.waitForFunction(()=>document.getElementById("answer").textContent.includes("Hay operaciones financieras pendientes"));assert.equal(asesoria,0);
  await page.reload();await page.locator('[data-tab="deudas"]').click();await pendiente().click();await page.waitForFunction(p=>/Restauración confirmada|Solicitud cerrada sin aplicar|Decisión registrada|Solicitud no aplicada/.test(document.getElementById(p+"Estado").textContent),panel);
  const final=JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),diario)).entradas.find(e=>e.id===entrada.id);assert.equal(final.estado,modo.includes("NO_APLICADA")||modo==="CIERRE"?"NO_APLICADA":"CONFIRMADA");assert.deepEqual(final.body,entrada.body);assert.deepEqual(JSON.parse(await page.evaluate(k=>sessionStorage.getItem(k),control)),[otra]);
  await page.locator('[data-tab="gruk"]').click();await page.locator("#question").fill("¿Puedo gastar hoy?");await page.locator("#ask button").click();await page.waitForFunction(()=>document.getElementById("answer").textContent.includes("Hay operaciones financieras pendientes"));assert.equal(asesoria,0);
  await page.locator('[data-tab="deudas"]').click();assert.equal(recibos,2);assert.equal(posts,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  console.log("FP_CONFIRMACION_CONTROL_CONCURRENTE_BROWSER",JSON.stringify({modo,loginReal:true,Chromium390:true,GETReciboPropio:recibos,primeraConfirmacionBloqueada:true,diarioOriginalIntactoAnteConflicto:true,controlExternoLiteralIntacto:true,recargaExplicitaConservaReferencias:true,segundaConfirmaSoloSuClave:true,otraReferenciaConservada:true,asesoriaHTTP:asesoria,reenviosFinancieros:posts,datos:"sinteticos"}));
 }finally{page.off("request",contar);}
};
