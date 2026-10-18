"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");

const script=path.resolve(__dirname,"../../scripts/diagnose-personal-merge.sh");

function git(dir,...args){
 const result=cp.spawnSync("git",args,{cwd:dir,encoding:"utf8"});
 assert.equal(result.status,0,`git ${args.join(" ")}: ${result.stderr}`);
 return result.stdout.trim();
}

function escenario({conflicto}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-merge-diagnostic-"));
 git(dir,"init","-q");
 git(dir,"config","user.email","ci@example.invalid");
 git(dir,"config","user.name","Prueba CI");
 fs.writeFileSync(path.join(dir,"shared.txt"),"original\n");
 git(dir,"add","shared.txt");
 git(dir,"commit","-qm","base");
 const base=git(dir,"rev-parse","HEAD");
 git(dir,"branch","-M","main");
 fs.writeFileSync(path.join(dir,"shared.txt"),"empresa\n");
 git(dir,"commit","-qam","cambio empresarial");
 const main=git(dir,"rev-parse","HEAD");
 git(dir,"checkout","-qb","feature/finanzas-personales",base);
 fs.writeFileSync(path.join(dir,"shared.txt"),conflicto?"personal\n":"original\n");
 if(conflicto){
  git(dir,"commit","-qam","cambio personal");
 }else{
  fs.writeFileSync(path.join(dir,"solo-personal.txt"),"aislado\n");
  git(dir,"add","solo-personal.txt");
  git(dir,"commit","-qm","archivo personal aislado");
 }
 const personal=git(dir,"rev-parse","HEAD");
 git(dir,"update-ref","refs/remotes/origin/main",main);
 git(dir,"update-ref","refs/remotes/origin/feature/finanzas-personales",personal);
 return {dir,personal,main};
}

for(const conflicto of [false,true]){
 test(`diagnóstico Git real ${conflicto?"detecta conflictos":"reconoce integración limpia"} sin mutar ramas`,()=>{
  const {dir,personal,main}=escenario({conflicto});
  try{
   const previo=git(dir,"status","--porcelain");
   const resultado=cp.spawnSync("bash",[script],{cwd:dir,encoding:"utf8"});
   assert.equal(resultado.status,conflicto?1:0,resultado.stderr);
   assert.match(resultado.stdout,conflicto?/CONFLICTOS_DE_FUSION_DETECTADOS/:/SIN_CONFLICTOS_DE_FUSION/);
   assert.equal(git(dir,"rev-parse","HEAD"),personal);
   assert.equal(git(dir,"rev-parse","refs/remotes/origin/main"),main);
   assert.equal(git(dir,"status","--porcelain"),previo);
  }finally{
   fs.rmSync(dir,{recursive:true,force:true});
  }
 });
}

test("diagnóstico rechaza una referencia que avanzó después de iniciar el workflow",()=>{
 const {dir,personal}=escenario({conflicto:false});
 try{
  const resultado=cp.spawnSync("bash",[script],{
   cwd:dir,encoding:"utf8",
   env:{...process.env,GRUK_EXPECTED_HEAD_SHA:"0".repeat(40)}
  });
  assert.equal(resultado.status,3);
  assert.match(resultado.stderr,/DIAGNOSTICO_OBSOLETO/);
  assert.equal(git(dir,"rev-parse","HEAD"),personal);
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
