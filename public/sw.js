"use strict";
const CACHE_NAME="gruk-shell-v6";
const SHELL=["/finanzas-personales.css","/finanzas-personales.js","/gruk-app-icon.svg","/manifest.webmanifest"];
const OFFLINE_HTML='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GRUK · Sin conexión</title><style>body{margin:0;background:#0b0d10;color:#f5f7fa;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:450px;padding:32px}h1{font-size:27px}p{line-height:1.6;color:#b9c3cf}button{background:#f5f7fa;color:#0b0d10;padding:14px 18px;border:0;border-radius:10px;font-weight:700}</style></head><body><main><h1>GRUK no pudo conectarse</h1><p>La aplicación puede estar despertando en Render o no hay conexión a internet. Tus saldos no se reemplazarán por ceros. Espera un momento e inténtalo nuevamente.</p><button onclick="location.reload()">Reintentar</button></main></body></html>';
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith("gruk-shell-")&&name!==CACHE_NAME).map(name=>caches.delete(name)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||/^\/(api|internal|socket\.io)(\/|$)/.test(url.pathname))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
   if(!response.ok)throw new Error("GRUK_DOCUMENT_UNAVAILABLE");
   return response;
  }).catch(()=>new Response(OFFLINE_HTML,{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})));
  return;
 }
 if(!["script","style","image","manifest"].includes(request.destination))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==="basic"){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));
  }
  return response;
 }).catch(async()=>{
  const fallback=await caches.match(request);
  if(fallback)return fallback;
  return new Response("Recurso GRUK no disponible. Conéctate y vuelve a cargar.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
 }));
});
