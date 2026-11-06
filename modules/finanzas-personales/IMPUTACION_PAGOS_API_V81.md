# Imputación explícita de pagos V81
Fecha: 2026-11-06. Solo Finanzas Personales; PR #389 abierto, #407 abierto.
Padre verificado bdd1f84f3bfbd5bb55ff7f62058fdc5ccf5647e2; árbol ad76c0e00cb465094553f7ed2674a1defb196ccd. Base feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e. CI del padre verde: Gate 42171339190, Seguridad 42171339181, V81 42171339215; Mongo autorizado 76/76.

## Plan y aceptación del bloque
Permitir al propietario revisar un pago existente y decidir APLICAR a la cuota de contexto actual, EXCLUIR de esa cuota o ANULAR la decisión previa. Una decisión modifica exclusivamente la imputación para reservas/proyección; no es otro pago, ni altera capital, saldo de cuenta, fuente o compensación original.
Requiere propietario JWT, confirmación booleana estricta, motivo, fuente exacta, contexto exacto, revisión del préstamo, hash de decisión previa y clave idempotente. Otro propietario, contexto/fuente desactualizados, firma original dañada, datos coercibles, índices ausentes, cadena/cursor discordantes o clave ausente deben fallar sin cambios financieros. Anular conserva todos los eventos; nueva revisión permite recuperar una decisión sin borrar historial. Reintento devuelve recibo, no certifica vigencia actual.

## Contrato e integración
GET /prestamos/:id/imputaciones entrega pagos compensados activos, contexto, revisión, huella de fuente, decisión previa e historial verificado del propietario, sin caché. POST en la misma ruta toma Idempotency-Key (8–100 caracteres alfanuméricos, guion o guion bajo) y cuerpo estricto:
movimientoId, tratamiento (APLICAR/EXCLUIR/ANULAR), revisionEsperada, fuenteHashEsperado, eventoEsperado (hash o null), contextoEsperado, confirmacion:true y motivo (8–240 caracteres).
contextoEsperado incluye fechaVencimiento ISO exacta, cuotaMinor entera positiva, periodicidad confirmada, periodicidadConfirmada:true y diaPago (1–31 o null).
Rutas bajo autenticación/entitlement personal. Rechaza usuarioId u otros campos ajenos en cuerpo. Respuesta deltaCajaMinor:0 y certificaVigencia:false. La huella SHA no es cifrado.
Home y Proyección verifican decisiones con las mismas deudas y fuentes en snapshot; Disponible, Master y resumen HTTP heredan el bloqueo de pendientes. EXCLUIR no elimina el pago del flujo realizado ni de la fuente: solo evita aplicarlo a esta cuota. Cambiar fuente/contexto vuelve a requerir revisión. Firma original inválida nunca se sanea con una imputación.
Los pagos anulados no se ofrecen para imputar. Restaurar pagos mantiene sus condiciones y secuencia existentes: esta API no elude el bloqueo de restauración de un pago firmado cuyo ciclo cambió. No adelanta vencimientos ni infiere amortizaciones.

## Persistencia, seguridad y recuperación
Nueva colección fin_imputaciones_pagos_personales_v1, modelo INSERT-only con índices únicos propietario/préstamo/secuencia y propietario/solicitud. HMAC separado FP_IMPUTACION_PAGO_V1 con PERSONAL_IDEMPOTENCY_SECRET existente y cadena SHA256; revisión/hash mutable del préstamo detectan discordancia de cola. El administrador debe conservar y proteger claves; no hay rotación automática. No protege por sí sola contra administrador con control de cadena, cursor y claves, ni acredita custodio independiente.
Transacción snapshot/majority: serializa escrituras nuevas, inserta evento y actualiza cursor del préstamo. Un replay verificado no escribe siquiera el cursor de compatibilidad. No toca cuentas, fuentes, Outbox ni saldo/principal. Correcciones/retiros excluyen del estado económico los metadatos de imputación.
Política de aplicación cubre ahora 21 colecciones protegidas. Provisión solo administrativa, idempotente y sin borrar índices; esta ejecución no provisiona producción. Backup V19 incorpora la colección 39 y conserva lectura de V18 con sus 38 colecciones y versiones previas. No hay backfill, limpieza ni migración destructiva.
Límites: 1000 eventos por préstamo, 10000 en lectura agrupada, 5000 fuentes/préstamos según contrato previo, maxTimeMS; exceso bloquea. No se afirma carga inmediata ni rendimiento en producción.

## Validación
Local Node 24: módulo 575 casos / 566 aprobados / 9 omitidos / cero fallos; CI personal 338 / 334 / 4; dirigidas 48/48, nuevas puras/handler 7/7; sintaxis y diff --check satisfactorios.
Nuevo ensayo Mongo autorizado: aplicar/excluir/anular y consulta, caja y original intactos, replay y aislamiento, snapshot concurrente, dos claves con revisión igual y clave repetida, contexto cambiado, rollback tras inserción, índice retirado, firma alterada, cola truncada y clave ausente. Corrupciones y retiros de índice solo en fixture administrado aislado. Resultado del SHA publicado pendiente de CI; no declarar aprobación hasta observarlo.

## Siguiente y gates abiertos
Interfaz de revisión/confirmación/anulación de imputaciones y recuperación ante respuesta perdida, con estados claros para fuente/calendario cambiado. Pendiente validar UX/dispositivos. #407 conserva gate independiente real, privilegios/índices y credenciales de producción, backups independientes/retención/acceso, restauración aislada operativa y métricas RPO/RTO, aceptación integral de seguridad/concurrencia/migración/aislamiento/recuperación e informe trazable. Ensayo sintético no acredita producción. No merge a feature ni despliegue Render, main/Empresarial/Blushéa sin cambios.
