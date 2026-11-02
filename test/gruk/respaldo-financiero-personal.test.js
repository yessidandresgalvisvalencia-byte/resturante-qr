"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {BSON}=require("mongoose").mongo;
const {COLECCIONES,cifrar,descifrar,validarDestino,restaurarEnEnsayo}=require("../../modules/finanzas-personales/services/respaldoFinancieroPersonal.service");
function contenido(){
 const raw=BSON.serialize({_id:new BSON.ObjectId(),decimal:BSON.Decimal128.fromString("123.45"),entero:BSON.Long.fromString("9007199254740993"),fecha:new Date("2026-11-02T00:00:00Z")});
 return{version:9,inicio:"2026-11-02T00:00:00.000Z",fin:"2026-11-02T00:00:01.000Z",retenerHasta:"2026-12-02T00:00:00.000Z",
  colecciones:COLECCIONES.map((nombre,i)=>({nombre,indices:[{name:"_id_",key:{_id:1}}],documentos:i===0?[raw.toString("base64")]:[],hash:crypto.createHash("sha256").update(i===0?raw:Buffer.alloc(0)).digest("hex")}))};
}
test("respaldo cifrado conserva BSON, fechas, decimales y enteros sin imprimir datos",()=>{
 const p=contenido(),clave=crypto.randomBytes(32),a=cifrar(p,clave),b=cifrar(p,clave);
 assert.deepEqual(descifrar(a,clave),p);assert.notDeepEqual(a,b);assert.equal(a.includes(Buffer.from(p.colecciones[0].documentos[0])),false);
 assert.equal(a.includes(Buffer.from(clave.toString("hex"))),false);
});
test("alteración, clave incorrecta o manifiesto incompleto se rechazan",()=>{
 const clave=crypto.randomBytes(32),p=contenido(),archivo=cifrar(p,clave),obj=JSON.parse(archivo);
 obj.etiqueta=crypto.randomBytes(16).toString("base64");
 assert.throws(()=>descifrar(Buffer.from(JSON.stringify(obj)),clave),/autenticar/);
 assert.throws(()=>descifrar(archivo,crypto.randomBytes(32)),/autenticar/);
 assert.throws(()=>cifrar({...p,colecciones:p.colecciones.slice(1)},clave),/Manifiesto/);
 assert.throws(()=>cifrar({...p,retenerHasta:p.fin},clave),/Manifiesto/);
 const alterado=contenido();alterado.colecciones[0].hash="f".repeat(64);assert.throws(()=>cifrar(alterado,clave),/Hash/);
 const ttl=contenido();ttl.colecciones[0].indices.push({name:"ttl",key:{fecha:1},expireAfterSeconds:1});assert.throws(()=>cifrar(ttl,clave),/TTL/);
 assert.throws(()=>cifrar(p,Buffer.alloc(16)),/32 bytes/);
});
test("restauración rechaza producción, otros hosts, credenciales en URI y bases no dedicadas antes de conectar",async()=>{
 const valido="mongodb://127.0.0.1:27018/gruk_v81_restore_test_0123456789abcdef";
 assert.equal(validarDestino(valido,"test"),"gruk_v81_restore_test_0123456789abcdef");
 assert.throws(()=>validarDestino(valido,"production"));
 for(const uri of ["mongodb://externo:27018/gruk_v81_restore_test_0123456789abcdef", "mongodb://127.0.0.1:27018/produccion",
  valido+"?dbName=otra",valido+"#otra",valido.replace("127.0.0.1","u:p@127.0.0.1"),valido.replace("27018","27017")]){
  assert.throws(()=>validarDestino(uri,"test"));
  await assert.rejects(restaurarEnEnsayo({uri,archivo:Buffer.alloc(0),clave:Buffer.alloc(32)}),e=>e.code==="RESPALDO_PERSONAL_RECHAZADO");
 }
});

test("el formato nuevo conserva lectura de paquetes V1 de doce colecciones",()=>{
 const p=contenido();p.version=1;p.colecciones=p.colecciones.slice(0,12);
 const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,12);
});

test("payload V2 de trece colecciones sigue siendo recuperable",()=>{
 const p=contenido();p.version=2;p.colecciones=p.colecciones.slice(0,13);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,13);
});

test("backup V3 conserva lectura de sus quince colecciones",()=>{const p=contenido();p.version=3;p.colecciones=p.colecciones.slice(0,15);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,15);});

test("backup V4 conserva sus dieciséis colecciones",()=>{const p=contenido();p.version=4;p.colecciones=p.colecciones.slice(0,16);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,16);});

test("backup V5 conserva sus dieciocho colecciones",()=>{const p=contenido();p.version=5;p.colecciones=p.colecciones.slice(0,18);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,18);});

test("backup V6 conserva sus diecinueve colecciones",()=>{const p=contenido();p.version=6;p.colecciones=p.colecciones.slice(0,19);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,19);});

test("backup V7 conserva sus veinte colecciones",()=>{const p=contenido();p.version=7;p.colecciones=p.colecciones.slice(0,20);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,20);});

test("backup V8 conserva sus veintiuna colecciones",()=>{const p=contenido();p.version=8;p.colecciones=p.colecciones.slice(0,21);const clave=crypto.randomBytes(32);assert.equal(descifrar(cifrar(p,clave),clave).colecciones.length,21);});
