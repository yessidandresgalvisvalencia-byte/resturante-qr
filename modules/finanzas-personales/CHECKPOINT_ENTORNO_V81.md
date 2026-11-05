# Checkpoint operativo V81 — 2026-11-05

## Estado verificable

PR [#389](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/389) abierto, sin integrar. Rama de trabajo: `integration/fp-hormiga-clasificacion-credito-v81`; base: `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`.
HEAD funcional revisado: `ad5180b541a7836c7304217348294b09ba363e9c`, árbol `99b05a37aa8899cb7f18466dfca80b8368a24112`. Este documento se publica como descendiente documental; su SHA se obtiene del historial Git, sin cambiar el código.

CI del HEAD funcional consultada nuevamente en esta ejecución:

| Evidencia | Resultado |
| --- | --- |
| [GRUK Gate 42052040517](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42052040517) | success |
| [Seguridad 42052040554](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42052040554) | success |
| [V81 42052040660](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42052040660) | success |
| [Job autenticado 127330386494](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42052040660/job/127330386494) | 65 pruebas, 65 aprobadas, cero fallos; log releído |

El detalle acumulado de implementación y pendientes está en [CONTINUIDAD_V81.md](CONTINUIDAD_V81.md); la matriz de interfaz en [CALENDARIO_INTERFAZ_V81.md](CALENDARIO_INTERFAZ_V81.md). No sustituir esos documentos con extractos parciales.

## Bloqueo de esta ejecución y alcance

El entorno adjunto aparece no disponible. Una comprobación de ejecución de `pwd` devolvió: “No usable execution environment is available. Wait for an environment to become available before using this tool.” GitHub permite lectura y publicación documental. No se ejecutaron pruebas locales ni se implementó un bloque funcional nuevo. No se equipara revisar CI anterior a probar código nuevo.

Requisito para retomar implementación: disponer de un ejecutor del repositorio con Node y dependencias compatibles con sus workflows; comprobar sus instrucciones y HEAD real antes de editar, ejecutar las pruebas del módulo y completar CI autenticada del SHA publicado. Es una indisponibilidad del entorno, no evidencia de fallo o pérdida de la base de producción. No se cambia la programación de seguimiento por este fallo temporal.

Los avisos del usuario sobre demora y fecha desactualizada siguen requiriendo medición funcional y de interfaz en el servicio personal y dispositivos reales. No se promete carga instantánea, no se demuestra pérdida de datos y no se declara resuelto un incidente productivo con pruebas sintéticas.

## Siguiente lote: adopción explícita de calendarios anteriores

Plan de hasta tres bloques; cada uno requiere comportamiento, casos normales y fallos, integración y evidencia antes de contarse completo:

1. **Adopción con fuente verificable.** Diseñar una acción explícita del propietario que conserve copia íntegra e identidad/huella/versión del original en eventos append-only. Rechazar fuente ausente, ajena, modificada o ambigua; no inferir identidad por concepto/monto. Nunca actualizar, desactivar o eliminar el documento original. La misma solicitud devuelve su recibo; otra carga con la misma clave se rechaza.
2. **Planificación sin duplicación.** Leer fuente y eventos en una instantánea; sustituir la planificación legada por su adopción exactamente una vez. Retirar el calendario adoptado no debe reactivar silenciosamente la fuente legada. Restaurar no duplica caja, ingreso ni planificación; no inventar ocurrencias o recepción. Verificar competencia entre adopción, edición de fuente y solicitudes simultáneas, rollback completo y lectura con permisos reales del rol de aplicación. Si el esquema existente no garantiza la concurrencia, documentar/rediseñar antes de habilitar adopción.
3. **Confirmación y recuperación en interfaz.** Mostrar el original y su versión antes de confirmar; persistir solicitud exacta antes del envío; recuperar recibo tras respuesta perdida sin segunda mutación. Aislar propietario/sesión, conservar pendientes y formulario en fallos, rechazar selección obsoleta. Probar DOM/controlador/HTTP y dejar aceptación visual/dispositivos pendiente hasta evidencia real.

Criterios comunes: enteros monetarios exactos; cero escritura en cuentas/transacciones/caja por gestionar calendario; eventos e idempotencia atómicos; acceso cruzado rechazado; historial original recuperable; índices/roles/backup revisados si cambia el modelo. Probar casos de fin de mes, fecha de Colombia, fecha vencida y cambio de día sin convertir planificación en ingreso recibido. Releer gastoInteligentePersonal.service.js y sus pruebas para no duplicar las correcciones ya documentadas de horizonte de ingreso y evaluación estricta de compra.

Antes de publicar: comprobar que HEAD remoto sigue siendo el padre esperado; actualizar únicamente esta rama con lease y sin force. Ante cambio remoto, detener la actualización y revisar el nuevo HEAD. Confirmar CI del SHA exacto y registrar resultados en la continuidad del módulo.

## Condiciones de liberación conservadas

[#407](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407) permanece abierto. Siguen pendientes evidencia real de custodio independiente, copia completa durable y retención/acceso/claves separados, recuperación aislada operativa con métricas y RPO/RTO de producción, roles MongoDB sin UPDATE/DELETE de historial, índices e históricos reales, seguridad/concurrencia/idempotencia/migración/aislamiento/recuperación, compatibilidad y aceptación de interfaz/dispositivos e informe final trazable.

Los ensayos aislados previos no prueban custodia independiente ni recuperación garantizada en producción. No se omiten gates, se fabrican auditorías o se atribuye certificación externa. No hubo merge a feature, despliegue Render, cambio en main/Empresarial/Blushéa, aumento de costos, escritura/borrado de datos reales ni restauración productiva.

## Reanudación — 2026-11-05

El ejecutor volvió a estar disponible en la siguiente ejecución con cambios. Se reconstruyó el árbol exacto del HEAD `92ed3dd59c5832572d0a6a18486ccc24a6f6cc88` antes de editar. Se priorizó proteger los originales legados como requisito previo de adopción; ver CALENDARIO_LEGADO_PROTEGIDO_V81.md y la entrada nueva en CONTINUIDAD_V81.md. La indisponibilidad anterior no representa el estado vigente del ejecutor. Adopción e incidentes de interfaz/productivos conservan sus criterios pendientes.
