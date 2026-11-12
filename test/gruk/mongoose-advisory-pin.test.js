"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
test("Mongoose security patch is pinned consistently in manifest and npm lockfile",()=>{
 const root=path.resolve(__dirname,"../..");
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
 const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
 assert.equal(pkg.dependencies.mongoose,"9.11.4");
 assert.equal(lock.packages[""].dependencies.mongoose,"9.11.4");
 const mongoose=lock.packages["node_modules/mongoose"];
 assert.equal(mongoose.version,"9.11.4");
 assert.equal(mongoose.resolved,"https://registry.npmjs.org/mongoose/-/mongoose-9.11.4.tgz");
 assert.match(mongoose.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/);
 assert.equal(mongoose.dependencies.mquery,lock.packages["node_modules/mquery"].version);
 assert.equal(lock.packages["node_modules/mquery"].version,"6.0.1");
 assert.match(lock.packages["node_modules/mquery"].integrity,/^sha512-/);
});