"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearIncrementadorRedisV81}=require("../../modules/finanzas-personales/security/contadorRedisV81.service");
test("Redis real V81: 40 incrementos simultáneos atómicos y expiración",{
 skip:!process.env.GRUK_V81_TEST_REDIS_URL
},async()=>{
 const net=require("node:net");
 const {URL}=require("node:url");
 const url=new URL(process.env.GRUK_V81_TEST_REDIS_URL);
 if(url.protocol!=="redis:"||!["127.0.0.1","localhost"].includes(url.hostname)||url.port!=="6379"||
    url.password||url.username||url.pathname!=="/0")throw Error("Redis V81: solo instancia local efímera sin credenciales");
 const serializar=partes=>"*"+partes.length+"\r\n"+partes.map(s=>"$"+Buffer.byteLength(String(s))+"\r\n"+s+"\r\n").join("");
 function cliente(){
  return new Promise((resolve,reject)=>{
   const socket=net.createConnection({host:"127.0.0.1",port:6379});
   socket.once("error",reject);
   socket.once("connect",()=>resolve({socket,eval:async(script,{keys,arguments:args})=>{
    const respuesta=await new Promise((done,fail)=>{
     let buf="";
     const data=chunk=>{buf+=chunk.toString();const ints=[...buf.matchAll(/:(-?\d+)\r\n/g)].map(v=>Number(v[1]));if(ints.length>=2){socket.off("data",data);done(ints.slice(-2));}};
     socket.on("data",data);
     socket.write(serializar(["EVAL",script,keys.length,...keys,...args]),e=>{if(e){socket.off("data",data);fail(e);}});
    });
    return respuesta;
   }}));
  });
 }
 const connections=await Promise.all(Array.from({length:40},cliente));
 try{
  const clave="fin:v81:write:507f1f77bcf86cd799439011";
  const results=await Promise.all(Array.from({length:40},(_,i)=>crearIncrementadorRedisV81(connections[i])(clave,10)));
  assert.deepEqual(results.map(x=>x.cantidad).sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));
  assert.ok(results.every(x=>x.restanteSegundos>=1&&x.restanteSegundos<=10));
  // Verificar la decisión HTTP del middleware usando Redis real entre 40 clientes.
  const {crearLimiteDistribuidoV81}=require("../../modules/finanzas-personales/security/limiteDistribuidoV81.middleware");
  const usuarioId="507f191e810c19729de860ea";
  const respuestas=await Promise.all(connections.map(async conexion=>{
   const limite=crearLimiteDistribuidoV81({incrementar:crearIncrementadorRedisV81(conexion),limite:20,ventanaSegundos:10});
   return new Promise((resolve,reject)=>{
    const res={codigo:200,headers:{},status(n){this.codigo=n;return this;},
     setHeader(k,v){this.headers[k]=v;},json(payload){resolve({codigo:this.codigo,headers:this.headers,payload});}};
    Promise.resolve(limite({personalAuth:{userId:usuarioId,verificado:true}},res,
     ()=>resolve({codigo:200}))).catch(reject);
   });
  }));
  assert.equal(respuestas.filter(x=>x.codigo===200).length,20);
  assert.equal(respuestas.filter(x=>x.codigo===429).length,20);
  assert.ok(respuestas.filter(x=>x.codigo===429).every(x=>Number(x.headers["Retry-After"])>=1));

 }finally{for(const c of connections)c.socket.destroy();}
});
