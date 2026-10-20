"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../public/sw.js"),"utf8");

function serviceWorkerTest(){
 const callbacks={};
 const saved=new Map();
 const cache={addAll:async()=>{},put:async(request,response)=>saved.set(request.url,response),match:async(request)=>saved.get(request.url)};
 const caches={open:async()=>cache,keys:async()=>["gruk-shell-v6","gruk-shell-v7"],delete:async()=>true,match:async request=>saved.get(request.url)};
 const worker={location:{origin:"https://example.test"},addEventListener:(type,fn)=>callbacks[type]=fn,skipWaiting:()=>{},clients:{claim:()=>{}}};
 const context={self:worker,caches,Response,URL,AbortController,setTimeout,clearTimeout,fetch:async()=>{throw new Error("NETWORK_DOWN")},Promise};
 vm.runInNewContext(source,context,{filename:"sw.js"});
 return {callbacks,cache,saved};
}
async function requestOffline(url,destination,mode="cors"){
 const {callbacks}=serviceWorkerTest();
 let response;
 callbacks.fetch({request:{method:"GET",url,destination,mode},respondWith(promise){response=promise},waitUntil(){}});
 return response;
}
test("PWA offline: documento enseña error visible y nunca datos financieros ficticios",async()=>{
 const response=await requestOffline("https://example.test/","document","navigate");
 assert.equal(response.status,503);
 assert.match(response.headers.get("content-type"),/text\/html/);
 const html=await response.text();
 assert.match(html,/GRUK no pudo conectarse/);
 assert.match(html,/Reintentar/);
 assert.doesNotMatch(html,/\$0/);
});
test("PWA offline: JS/CSS no reciben HTML cuando falta el recurso",async()=>{
 for(const [file,destination] of [["finanzas-personales.js","script"],["finanzas-personales.css","style"]]){
  const response=await requestOffline("https://example.test/"+file,destination);
  assert.equal(response.status,503);
  assert.match(response.headers.get("content-type"),/text\/plain/);
  assert.doesNotMatch(await response.text(),/<!doctype html/i);
 }
});
test("PWA offline: ninguna petición de API es capturada por service worker",()=>{
 const {callbacks}=serviceWorkerTest();
 let intercepted=false;
 callbacks.fetch({request:{method:"GET",url:"https://example.test/api/resumen",destination:"",mode:"cors"},respondWith(){intercepted=true}});
 assert.equal(intercepted,false);
});
