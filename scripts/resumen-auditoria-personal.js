"use strict";
const fs=require("node:fs");
const file=process.argv[2];
if(!file)throw new Error("Se requiere la ruta del informe npm audit");
let audit;
try{audit=JSON.parse(fs.readFileSync(file,"utf8"));}
catch(_){process.stdout.write("### Auditoría de dependencias GRUK\nNo se pudo leer el informe JSON; revisar el log de npm audit.\n");process.exit(1);}
if(!audit||typeof audit!=="object"||Array.isArray(audit)||!audit.vulnerabilities||
   typeof audit.vulnerabilities!=="object"||Array.isArray(audit.vulnerabilities)){
 process.stdout.write("### Auditoría de dependencias GRUK\nInforme incompleto: no se puede certificar ausencia de alertas.\n");
 process.exit(1);
}
const vulnerabilidades=audit.vulnerabilities;
const severidades={critical:0,high:0,moderate:0,low:0};
const filas=[];
for(const [nombre,v] of Object.entries(vulnerabilidades)){
 const nivel=v.severity||"unknown";
 if(Object.hasOwn(severidades,nivel))severidades[nivel]++;
 if(!["critical","high"].includes(nivel))continue;
 const origenes=(Array.isArray(v.via)?v.via:[]).filter(x=>x&&typeof x==="object").map(x=>x.url).filter(x=>typeof x==="string"&&x.startsWith("https://"));
 const correccion=v.fixAvailable===false?"No automática":typeof v.fixAvailable==="object"?
  "Actualizar "+String(v.fixAvailable.name||nombre)+" a "+String(v.fixAvailable.version||"versión no informada"):
  "Disponible con npm audit fix";
 const afectados=typeof v.range==="string"?v.range:"No informado";
 const camino=v.isDirect===true?"Directa":"Transitiva";
 const efectos=Array.isArray(v.effects)?v.effects.filter(x=>typeof x==="string").slice(0,5).join(", "):"";
 filas.push({nombre,nivel,correccion,origenes,afectados,camino,efectos});
}
let salida="### Auditoría de dependencias GRUK Finanzas Personales\n\n";
salida+="Críticas: "+severidades.critical+" · Altas: "+severidades.high+" · Moderadas: "+severidades.moderate+"\n\n";
salida+="| Paquete | Tipo | Severidad | Rango afectado | Corrección sugerida | Dependientes | Referencias |\n|---|---|---|---|---|---|---|\n";
const limpiar=s=>String(s).replace(/[|<>\r\n]/g," ").slice(0,180);
for(const x of filas){
 const urls=x.origenes.slice(0,3).map((url,i)=>"[Aviso "+(i+1)+"]("+url+")").join(", ");
 const rango="`"+String(x.afectados).replace(/[|`\r\n]/g," ").slice(0,180)+"`";
 salida+="| "+limpiar(x.nombre)+" | "+x.camino+" | "+x.nivel+" | "+rango+" | "+limpiar(x.correccion)+" | "+limpiar(x.efectos)+" | "+urls+" |\n";
}
if(filas.length===0)salida+="| Sin alertas altas o críticas | — | — | — | — | — | — |\n";
process.stdout.write(salida);
if(severidades.high||severidades.critical)process.exitCode=1;
