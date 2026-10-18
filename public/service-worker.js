"use strict";
// GRUK app shell: no offline sales, payments, API or sensitive documents cached.
const CACHE_NAME="gruk-static-shell-v3";
const SAFE_ASSETS=new Set(["/style.css","/js/gruk-offline-outbox.js","/js/gruk-offline-transport.js","/js/gruk-offline-draft.js","/js/gruk-offline-panel.js","/offline-status.html"]);
self.addEventListener("install",event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim());});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/pagos/")||url.pathname.startsWith("/socket.io/"))return;
 if(request.mode==="navigate"&&url.pathname!=="/offline-status.html")return; // ordering screens never cached
 if(!SAFE_ASSETS.has(url.pathname))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok&&response.type==="basic"){
    const cache=await caches.open(CACHE_NAME);
    await cache.put(request,response.clone());
   }
   return response;
  }catch(error){
   const cached=await caches.match(request);
   if(cached)return cached;
   throw error;
  }
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("gruk-static-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))));
});
