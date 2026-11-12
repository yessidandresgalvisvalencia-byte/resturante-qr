"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.join(__dirname,"../..");

test("GRUK plan scheduled checkpoint validates 77 requirements without authorizing deployment",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-word-audit-"));
 try{
  const filename=path.join(dir,"evidence.json");
  execFileSync(process.execPath,[path.join(root,"scripts/gruk-scheduled-progress.js"),filename],{cwd:root});
  const report=JSON.parse(fs.readFileSync(filename,"utf8"));
  assert.equal(report.requirements.total,77);
  assert.equal(report.remaining+report.requirements.counts.VERIFICADO,77);
  assert.equal(report.releaseAuthorized,false);
  assert.equal(report.requirements.releaseAuthorized,false);
  assert.ok(Array.isArray(report.nextCriteria));
  assert.ok(report.nextCriteria.every(x=>x.status!=="VERIFICADO"));
  assert.ok(report.nextCriteria.every(x=>/^(P0|P1|P2|P3)$/.test(x.priority)));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("GitHub schedule contains exactly nine additional slots and no deploy or write permissions",()=>{
 const yaml=fs.readFileSync(path.join(root,".github/workflows/gruk-scheduled-word-audit.yml"),"utf8");
 assert.match(yaml,/cron: '0,20,25,30,35,40,45,50,55 \* \* \* \*'/);
 assert.match(yaml,/contents: read/);
 assert.doesNotMatch(yaml,/contents: write|pull-requests: write|DEPLOY_HOOK|render\/deploy/);
});
