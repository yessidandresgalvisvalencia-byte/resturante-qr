"use strict";
const {z}=require("zod");
const ulid=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/,"ULID_INVALIDO");
const centavos=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const tenant=z.object({empresaId:ulid,sedeId:ulid}).strict();
const tipos=["Empresa","Sede","Usuario","Producto","Pedido","Venta","Pago","Stock","Proveedor","MovimientoLedger","Bitacora"];
const recursos=Object.fromEntries(tipos.map(tipo=>[tipo,tenant.extend({
 id:ulid, tipo:z.literal(tipo),version:z.number().int().positive()
}).strict()]));
const movimiento=tenant.extend({
 id:ulid, secuencia:z.number().int().positive(), tipo:z.enum(["CREDITO","DEBITO","AJUSTE"]),
 montoCentavos:centavos.positive(),
 antesCentavos:centavos,
 despuesCentavos:centavos,
 actorId:ulid,
 ip:z.string().ip(),
 timestamp:z.string().datetime(),
 hashAnterior:z.string().regex(/^[a-f0-9]{64}$/),
 hash:z.string().regex(/^[a-f0-9]{64}$/),
 deletedAt:z.null()
}).strict();
module.exports={ulid,tenant,recursos,movimiento};
