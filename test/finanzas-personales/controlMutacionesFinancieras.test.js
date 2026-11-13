"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {crearControlMutacionesPersonales:crear}=require("../../public/finanzas-personales-control-mutaciones");
const digest=async v=>crypto.createHash("sha256").update(v).digest("hex");
function entorno(datos=new Map()){
 let cambios=0;const storage={getItem:k=>datos.get(k)??null,setItem:(k,v)=>datos.set(k,v)};
 const c=crear({almacenamiento:storage,digerir:digest,usuarioDeToken:t=>t,invalidar:()=>cambios++});
 return{c,datos,storage,cambios:()=>cambios};
}
const opciones=(id="idempotente_01",monto=1200)=>({method:"PATCH",headers:{"Idempotency-Key":id},body:JSON.stringify({principalMinor:monto,confirmacion:true})});
test("respuesta perdida persiste sin payload y el reintento tras recargar reutiliza la clave original",async()=>{
 const f=entorno(),op=await f.c.iniciar("A","/prestamos/p",opciones());assert.equal(f.c.estado("A").bloqueada,true);op.finalizar("INCIERTA");assert.equal(f.c.estado("A").bloqueada,true);
 const registro=JSON.stringify([...f.datos.values()]);assert.equal(registro.includes("principalMinor"),false);assert.equal(registro.includes("1200"),false);
 const recarga=entorno(f.datos);assert.equal(recarga.c.estado("A").bloqueada,true);assert.equal(recarga.c.estado("B").bloqueada,false);
 const retry=await recarga.c.iniciar("A","/prestamos/p",opciones("otra_clave"));assert.equal(retry.opciones.headers["Idempotency-Key"],"idempotente_01");retry.finalizar("CONFIRMADA");assert.equal(recarga.c.estado("A").bloqueada,false);assert.ok(recarga.cambios()>=2);
});
test("concurrencia, rechazos y claves incompatibles no confirman una operación incierta",async()=>{
 const f=entorno(),op=await f.c.iniciar("A","/prestamos/p",opciones());await assert.rejects(f.c.iniciar("A","/prestamos/p",opciones("segunda_clave")),/en curso/);op.finalizar("INCIERTA");
 await assert.rejects(f.c.iniciar("A","/prestamos/p",opciones("idempotente_01",1300)),/otros datos/);
 const r=await f.c.iniciar("A","/prestamos/p",opciones());r.finalizar("RECHAZADA");assert.equal(f.c.estado("A").bloqueada,true);
 const otra=await f.c.iniciar("B","/prestamos/p",opciones());otra.finalizar("RECHAZADA");assert.equal(f.c.estado("B").bloqueada,false);
});
test("una operación sin clave incierta no se reenvía ni autoriza otra modificación",async()=>{
 const f=entorno(),o={method:"POST",body:JSON.stringify({nombre:"Prueba"})},op=await f.c.iniciar("A","/ruta-legacy-sin-clave",o);op.finalizar("INCIERTA");await assert.rejects(f.c.iniciar("A","/ruta-legacy-sin-clave",o),/no tiene reintento seguro/);
 await assert.rejects(f.c.iniciar("A","/prestamos/p",opciones()),/antes de registrar otra/);assert.equal(f.c.estado("A").bloqueada,true);
});
test("almacenamiento dañado o no disponible falla cerrado, sin borrar datos",async()=>{
 const datos=new Map([["gruk.fp.operacionesPendientes.v81:A","dato inválido"]]),f=entorno(datos);assert.equal(f.c.estado("A").bloqueada,true);await assert.rejects(f.c.iniciar("A","/prestamos/p",opciones()),/registro local/);assert.equal(datos.get("gruk.fp.operacionesPendientes.v81:A"),"dato inválido");
 const c=crear({almacenamiento:{getItem:()=>null,setItem:()=>{throw Error("quota");}},digerir:digest,usuarioDeToken:t=>t});await assert.rejects(c.iniciar("A","/prestamos/p",opciones()),/conservar/);assert.equal(c.estado("A").bloqueada,true);
});
test("confirmar intento de movimiento solo resuelve la huella e identidad exactas",async()=>{
 const f=entorno(),body={tipo:"GASTO",montoMinor:1200,externalId:"movimiento_01"},op=await f.c.iniciar("A","/transacciones",{method:"POST",body:JSON.stringify(body)});op.finalizar("INCIERTA");
 await f.c.confirmarRegistro("A",{...body,montoMinor:1300});assert.equal(f.c.estado("A").bloqueada,true);await f.c.confirmarRegistro("B",body);assert.equal(f.c.estado("A").bloqueada,true);await f.c.confirmarRegistro("A",body);assert.equal(f.c.estado("A").bloqueada,false);
});

test("mecanismos de reintento ambiguos se rechazan antes de registrar o enviar",async()=>{const f=entorno();await assert.rejects(f.c.iniciar("A","/transacciones",{method:"POST",headers:{"Idempotency-Key":"clave_01"},body:JSON.stringify({externalId:"otra_clave",montoMinor:1200})}),/ambiguo/);assert.equal(f.c.estado("A").bloqueada,false);});

test("solo POST de consulta/preparación queda fuera de mutaciones monetarias; rutas desconocidas siguen protegidas",()=>{
 const f=entorno();assert.equal(f.c.esMutacion("/consulta",{method:"POST"},"A"),false);assert.equal(f.c.esMutacion("/consulta",{method:"post"},"A"),false);assert.equal(f.c.esMutacion("/copilot",{method:"POST"},"A"),false);
 for(const [p,o] of [["/copilot",{method:"DELETE"}],["/copilot/aprobar",{method:"POST"}],["/consulta",{method:"DELETE"}],["/consulta",{method:"PATCH"}],["/consulta/aprobar",{method:"POST"}],["/captura/id/aprobar",{method:"POST"}],["/transacciones",{method:"POST"}]])assert.equal(f.c.esMutacion(p,o,"A"),true);
});
test("clasificar nuevas consultas no elimina registros antiguos sin clave ni operaciones reales",async()=>{
 const f=entorno(),o={method:"POST",body:JSON.stringify({pregunta:"Disponible Hoy"})};const op=await f.c.iniciar("A","/consulta",o);op.finalizar("INCIERTA");const texto=JSON.stringify([...f.datos]);const recargado=entorno(f.datos);assert.equal(recargado.c.esMutacion("/consulta",o,"A"),false);assert.equal(recargado.c.estado("A").bloqueada,true);assert.equal(JSON.stringify([...f.datos]),texto);await assert.rejects(recargado.c.iniciar("A","/prestamos/p",opciones()),/antes de registrar otra/);
});
test("clasificar copilot nuevo no borra incertidumbres antiguas sin ruta recuperable",async()=>{const f=entorno(),o={method:"POST",body:JSON.stringify({texto:"Mensaje anterior"})},op=await f.c.iniciar("A","/copilot",o);op.finalizar("INCIERTA");const antes=JSON.stringify([...f.datos]);const recarga=entorno(f.datos);assert.equal(recarga.c.esMutacion("/copilot",o,"A"),false);assert.equal(recarga.c.estado("A").bloqueada,true);assert.equal(JSON.stringify([...f.datos]),antes);});
