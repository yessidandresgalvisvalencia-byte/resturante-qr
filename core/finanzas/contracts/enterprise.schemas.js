"use strict";
const { z } = require("zod");

const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "ULID_INVALIDO");
const dinero = z.object({
  amount: z.number().int().safe(),
  currency: z.literal("COP")
}).strict();
const identidad = { empresaId: ulid, sedeId: ulid };
const entidad = (shape) => z.object({ id: ulid, ...identidad, ...shape }).strict();
const Empresa = z.object({ id: ulid, nombre: z.string().trim().min(1) }).strict();
const Sede = entidad({ nombre: z.string().trim().min(1) });
const Usuario = entidad({ email: z.email(), rol: z.enum(["DUEÑO","ADMIN_SEDE","EMPLEADO"]) });
const Producto = entidad({ nombre: z.string().trim().min(1), precio: dinero });
const Pedido = entidad({ estado: z.enum(["BORRADOR","CONFIRMADO","COCINA","LISTO","ENTREGADO","FACTURADO"]) });
const Venta = entidad({ pedidoId: ulid, total: dinero });
const Pago = entidad({ ventaId: ulid, total: dinero, estado: z.enum(["PENDIENTE","PARCIAL","COMPLETO","CONCILIADO"]) });
const Stock = entidad({ productoId: ulid, cantidad: z.string().regex(/^-?\\d+(?:\\.\\d+)?$/) });
const Proveedor = entidad({ nombre: z.string().trim().min(1) });
const MovimientoLedger = entidad({
  secuencia: z.number().int().positive(),
  tipo: z.enum(["CREDITO","DEBITO","REVERSO"]),
  monto: dinero, antes: dinero, despues: dinero,
  actorId: ulid, ip: z.ipv4().or(z.ipv6()),
  timestamp: z.iso.datetime(), hashAnterior: z.string().regex(/^[a-f0-9]{64}$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  deletedAt: z.null(), idempotencyKey: z.string().min(8).max(200)
});
const Bitacora = entidad({
  actorId: ulid, origen: z.string().min(1),
  timestamp: z.iso.datetime(), evento: z.string().min(1),
  antes: z.unknown(), despues: z.unknown()
});
module.exports = { ulid, dinero, Empresa, Sede, Usuario, Producto, Pedido, Venta, Pago, Stock, Proveedor, MovimientoLedger, Bitacora };
