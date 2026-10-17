"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const sw=fs.readFileSync(path.join(__dirname,"../../public/service-worker.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"../../public/index.html"),"utf8");
const manifest=require("../../public/manifest.json");
test("PWA manifest and service worker registered",()=>{
 assert.equal(manifest.display,"standalone");
 assert.match(html,/rel="manifest"/);
 assert.match(html,/serviceWorker\.register\("\/service-worker\.js"\)/);
});
test("service worker never intercepts mutations or navigations",()=>{
 assert.match(sw,/request\.method!=="GET"/);
 assert.match(sw,/request\.mode==="navigate"/);
 assert.match(sw,/startsWith\("\/api\/"\)/);
 assert.match(sw,/startsWith\("\/pagos\/"\)/);
 assert.match(sw,/startsWith\("\/socket\.io\/"\)/);
 assert.doesNotMatch(sw,/cache\.addAll\(\["\/"\]/);
});
