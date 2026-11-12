#!/usr/bin/env node
"use strict";
// Scheduled progress evidence, not automated feature implementation or release approval.
const fs=require("node:fs");
const path=require("node:path");
const {validate}=require("./gruk-plan-master-audit");
const root=path.join(__dirname,"..");
const criteriaText=fs.readFileSync(path.join(root,"docs/GRUK_PLAN_MAESTRO_77_CRITERIOS.md"),"utf8");
const matrixText=fs.readFileSync(path.join(root,"docs/GRUK_PLAN_MAESTRO_77_TRAZABILIDAD.md"),"utf8");
const result=validate(criteriaText,matrixText);
const entries=matrixText.split(/\r?\n/).filter(line=>/^\|\s*\d{2}\s*\|/.test(line)).map(line=>{
 const [id,priority,title,status,evidence]=line.split("|").slice(1,-1).map(s=>s.trim());
 return {id,priority,title,status,evidence};
});
const prioritized=entries.filter(x=>x.status!=="VERIFICADO").sort((a,b)=>{
 const rank={P0:0,P1:1,P2:2,P3:3};
 return rank[a.priority]-rank[b.priority]||Number(a.id)-Number(b.id);
});
const report={
 generatedAt:new Date().toISOString(),source:"GRUK_Documentos_Unificados_Plan_Maestro.docx",
 repository:process.env.GITHUB_REPOSITORY||"yessidandresgalvisvalencia-byte/resturante-qr",
 commit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,
 requirements:result,remaining:prioritized.length,nextCriteria:prioritized.slice(0,10),
 releaseAuthorized:false,
 note:"GitHub Actions audit only. No autonomous coding, PR merging, or production deployment."
};
const output=process.argv[2]||"gruk-scheduled-progress.json";
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log("GRUK Word 77: "+JSON.stringify(result.counts)+"; remaining="+prioritized.length);
for(const x of prioritized.slice(0,3))console.log(x.id+" "+x.priority+" "+x.title+" — "+x.status);
if(result.allVerified)console.log("Matrix 77/77 marked verified; independent production gates still mandatory.");
