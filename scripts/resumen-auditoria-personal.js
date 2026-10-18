"use strict";
const fs=require("node:fs");
const file=process.argv[2];
if(!file)throw new Error("Se requiere la ruta del informe npm audit");
let audit;
try{audit=JSON.parse(fs.readFileSync(file,"utf8"));}
catch(_){process.stdout.write("### Auditoría de dependencias GRUK\nNo se pudo leer el informe JSON; revisar el log de npm audit.\n");process.exit(1);}
const vulnerabilidades=audit.vulnerabilities||{};
const severidades={critical:0,high:0,moderate:0,low:0};
const filas=[];
for(const [nombre,v] of Object.entries(vulnerabilidades)){
 const nivel=v.severity||"unknown";
 if(Object.hasOwn(severidades,nivel))severidades[nivel]++;
 if(!["critical","high"].includes(nivel))continue;
 const origenes=(Array.isArray(v.via)?v.via:[]).filter(x=>x&&typeof x==="object").map(x=>x.url).filter(x=>typeof x==="string"&&x.startsWith("https://"));
 filas.push({nombre,nivel,correccion:v.fixAvailable===false?"No automática":typeof v.fixAvailable==="object"?"Requiere actualización mayor":"Disponible",origenes});
}
let salida="### Auditoría de dependencias GRUK Finanzas Personales\n\n";
salida+="Críticas: "+severidades.critical+" · Altas: "+severidades.high+" · Moderadas: "+severidades.moderate+"\n\n";
salida+="| Paquete | Severidad | Corrección | Referencias |\n|---|---|---|---|\n";
for(const x of filas){
 const urls=x.origenes.slice(0,3).map((url,i)=>"[Aviso "+(i+1)+"]("+url+")").join(", ");
 salida+="| "+x.nombre.replace(/[|<>]/g,"")+" | "+x.nivel+" | "+x.correccion+" | "+urls+" |\n";
}
if(filas.length===0)salida+="| Sin alertas altas o críticas | — | — | — |\n";
process.stdout.write(salida);
if(severidades.high||severidades.critical)process.exitCode=1;
