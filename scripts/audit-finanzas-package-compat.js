"use strict";
const fs=require("node:fs");
const {execFileSync}=require("node:child_process");

const EXPECTED_MAIN="004720b27751aef4177996088ee6a6cbeae3d9a7";
const EXPECTED_PERSONAL="142ef903677aa4891916944df70a0bf38e5dcb61";
const expectedChanges=Object.freeze(["axios","multer"]);
function git(...args){return execFileSync("git",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();}
function parseManifest(ref){return JSON.parse(git("show",ref+":package.json"));}
function diffMap(a={},b={}){return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(k=>a[k]!==b[k]).map(name=>({name,main:a[name]??null,personal:b[name]??null}));}
function validate(main,personal){
 const deps=diffMap(main.dependencies,personal.dependencies);
 const dev=diffMap(main.devDependencies,personal.devDependencies);
 const onlyPersonalScripts=Object.keys(personal.scripts||{}).filter(k=>!(k in (main.scripts||{}))).sort();
 const changedScripts=Object.keys(personal.scripts||{}).filter(k=>k in(main.scripts||{})&&personal.scripts[k]!==main.scripts[k]).sort();
 const decisions={
  "axios":"CONFLICTO: main ^1.6.0, personal 1.20.0; probar funcionalidad y resolver lock sin bajar parches",
  "multer":"CONFLICTO: main ^2.1.1, personal ^2.3.0; validar API de uploads empresariales y auditoría",
  "nodemon":"Solo en dependencias de desarrollo de personal; no debe alterar el arranque productivo",
 };
 return {dependencies:deps,devDependencies:dev,personalScriptsToPreserve:onlyPersonalScripts,modifiedScripts:changedScripts,
  recommendations:decisions,blockers:deps.filter(x=>!expectedChanges.includes(x.name)).map(x=>x.name)};
}
function main(){
 const mainRef=git("rev-parse","origin/main");
 const personalRef=git("rev-parse","origin/feature/finanzas-personales");
 if(mainRef!==EXPECTED_MAIN||personalRef!==EXPECTED_PERSONAL){
  console.error("BASE_OBSOLETA",JSON.stringify({expectedMain:EXPECTED_MAIN,actualMain:mainRef,expectedPersonal:EXPECTED_PERSONAL,actualPersonal:personalRef}));
  process.exitCode=3;return;
 }
 const result=validate(parseManifest("origin/main"),parseManifest("origin/feature/finanzas-personales"));
 console.log(JSON.stringify(result,null,2));
 const actual=JSON.stringify(result.dependencies.map(x=>x.name));
 if(actual!==JSON.stringify(expectedChanges)){
  console.error("DEPENDENCIAS_DIVERGENTES_NUEVAS: revision humana antes de integrar");
  process.exitCode=2;return;
 }
 console.log("INFORME_COMPATIBILIDAD_GENERADO: no equivale a fusion ni a lockfile reconciliado");
}
if(require.main===module)main();
module.exports={diffMap,validate};
