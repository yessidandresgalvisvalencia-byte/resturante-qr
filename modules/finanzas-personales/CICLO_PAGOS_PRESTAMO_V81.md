# Ciclo verificable de pagos de préstamo V81
Fecha: 2026-11-06. Alcance exclusivo Finanzas Personales; PR #389; #407 sigue abierto.

## Plan y aceptación
Evitar descontar pagos de una cuota distinta por compartir mes calendario. Cada pago nuevo conserva contexto de vencimiento, cuota, periodicidad, confirmación y día, unido a propietario, movimiento, préstamo, capital, pago real, impacto y fecha. Firma HMAC con separación de dominio y PERSONAL_IDEMPOTENCY_SECRET existente. No incorpora secretos nuevos ni servicios.
Aceptar solo fuentes compensadas propias, íntegras y con contexto coincidente; rechazar duplicados, importes ambiguos, futuro, moneda/estado inválidos y desbordamiento. Home consulta historial compensado en la misma instantánea. Disponible Hoy y proyección no autorizan con pagos pendientes.
Anular conserva originales; restaurar un pago firmado con vencimiento distinto falla atómicamente. Repeticiones no duplican caja.

## Implementación y límites
Campo opcional cicloCuota en fuente INSERT-only; no migración ni backfill. Fuentes antiguas sin contexto quedan pendientes de imputación, sin alterarlas ni registrar otro pago. Pagos de préstamos fuera del conjunto activo no se reutilizan. Consultas históricas conservan límites de capacidad y verificaciones previas.
La firma autentica estos metadatos; no modifica ni sustituye los hashes históricos de compensaciones ni constituye custodia independiente. Reordenar JSON no invalida la firma. Falta de clave o firma alterada bloquea cálculo y restauración. Anular exige integridad pero permite corregir el efecto de un pago cuyo calendario cambió. Recuperación de pagos antiguos sin metadatos mantiene compatibilidad y después deja asesoría pendiente.
La clave existente requiere conservación y un procedimiento operativo de rotación/recuperación antes de producción; no regenerarla silenciosamente. No se infiere el próximo ciclo ni una amortización bancaria.
Pendiente siguiente: imputación explícita autorizada por el propietario, mediante evento append-only idempotente, sin reescribir fuentes ni duplicar efectos financieros. Hasta entonces, cambiar el vencimiento con pagos previos puede bloquear el asesor de forma conservadora.

## Evidencia
Padre revisado: 2a1fd3d7bbbc2f0e52805418f7ccdd554e7ad80f; árbol ae1a8521ad103cdc20089034b5d37747882b5afd. Base feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e; PR abierto sin integrar.
CI del padre: Gate 42165690946, Security 42165690812, V81 42165690993, todos satisfactorios; Mongo 127721533628: 75/75.
Local Node 24: módulo 567 casos, 558 aprobados, 9 omitidos, cero fallos; suite CI personal 338/334/4, cero fallos; dirigidas 30/30; sintaxis y diff --check satisfactorios.
Prueba nativa añadida: pago firmado, lectura sin mutaciones, cambio auditado de fecha, bloqueo Home/Disponible/Proyección/Master, replay, anulación, restauración rechazada sin cambios y recuperación al contexto original; corrupción administrada y clave ausente en fixture aislado; fuente antigua preservada. Resultado del SHA publicado pendiente de CI.
Los datos y las claves son sintéticos. No se han probado privilegios, backups ni recuperación de producción con este bloque. #407 requiere custodio independiente real, retención/acceso y claves, privilegios/índices reales Mongo, restauración aislada operativa, RPO/RTO y aceptación completa de seguridad, concurrencia, migración, aislamiento y dispositivos. No merge a feature ni despliegue Render.


## Ajuste de integración r56
El primer SHA 812e8b7c342aa1d5f1a4f1cf76710bb7ba2c256d falló Gate (42170849611: fixtures de Home sin propietario) y V81 (42170849608: resumen HTTP esperaba descontar pago manual sin ciclo). Se conserva validación de propietario; fixtures la declaran. Resumen HTTP también bloquea cuota/proyección/ratios si hay pagos sin imputación. Prueba nativa usa pago real del servicio para caso válido, conserva caso legado con flujo realizado y proyección desconocida. Nuevo ensayo puro cubre pendiente o colección malformada sin fabricar cuota. Módulo actualizado 568/559/9, cero fallos; ajuste dirigido 11/11 y sintaxis satisfactorios. La prueba nativa de ciclo nuevo sí pasó en el primer SHA; no se declara suite completa aprobada hasta CI corregida. Siguiente paso y gates #407 permanecen.


## Cierre verificado r56
SHA funcional corregido: 1b55ed54611c34374b789265dc35353bc30de67a; árbol 8ab7e2847c4770fd4846c48d906ccd025e53e213. Tres workflows satisfactorios para ese SHA: Gate 42171161000, Seguridad 42171160996 y V81 42171161002. Mongo autorizado job 127739042785: 76/76, cero omisiones y fallos. Ensayo sintético de respaldo: 38 colecciones, 5499 documentos, 3745246 bytes, captura 164 ms, restauración 864 ms y edad 994 ms; custodiaIndependiente=false y rpoProduccion=false. No extrapolar a datos reales ni SLA.
Bloque completo: pago ligado a ciclo firmado, cálculo solo con imputación verificable, Home/Disponible/Proyección/Master/resumen HTTP, conservación de fuentes, anulación y restauración atómicas y fallos seguros, casos normales/fallos en pruebas puras y Mongo autorizado. El commit posterior solo registra este resultado; se comprueba también su CI antes de entregar.
Siguiente: diseñar e implementar imputación append-only explícita por propietario para pagos legados o calendario cambiado, con confirmación, idempotencia, aislamiento y recuperación sin duplicar caja; después continuar criterios pendientes #407. Rama de integración únicamente. Feature base sin integrar, main/Empresarial/Blushéa sin cambios y Render sin despliegue. No hay acreditación independiente ni preparación final de producción.
