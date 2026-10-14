# GRUK V1000 — criterios para habilitar el ledger en producción

Estado: **NO CERTIFICADO / NO DESPLEGAR**. Los CI verdes comprueban escenarios delimitados y no equivalen a una certificación financiera integral.

## Garantías verificadas automáticamente
- Registros ACID con MongoDB replica set y cabecera por empresa y sede.
- Idempotencia por operacionId: concurrencia, reintentos y datos contradictorios.
- Saldos enteros en centavos y límites numéricos.
- Auditoría de hashes, secuencias y saldo; detección de alteración del historial en las pruebas.
- Rechazo de sobregiros simultáneos y rollback por saldo insuficiente.

## Riesgos que impiden activar el servicio como ledger principal
1. **Rendimiento O(n) por replay:** el servicio realiza auditoría completa de hasta 10.000 asientos cada vez que recupera una operación existente. No hay mediciones de latencia p50/p95/p99 ni pruebas de carga prolongada. Por encima del umbral falla cerrado; no hay auditoría particionada.
2. **Historial intermedio en nuevas escrituras:** el camino de nuevas operaciones comprueba la cabecera y último asiento, pero no audita el historial completo; no se debe afirmar que detecta toda manipulación histórica antes de cada alta.
3. **Commit desconocido:** se simulan resultados inciertos en tests; faltan ensayos reales de interrupción de red y failover, reconciliación operativa y observabilidad del estado indeterminado.
4. **Auditoría inmutable externa:** un actor con acceso directo privilegiado a MongoDB puede alterar o borrar documentos; no hay anclaje verificable fuera de la base de datos ni procedimiento probado de recuperación.
5. **Integración al sistema existente:** el ledger V1000 es una colección aislada. Falta integrar y comprobar el flujo real de pagos, ventas y outbox con la versión anterior sin doble contabilización ni interrupción.
6. **Control de acceso:** validar tenant en el servicio no sustituye autorización de roles en API, segregación de permisos DB y pruebas de acceso cruzado.
7. **Administración de despliegue:** faltan migración progresiva, pruebas de shadow traffic, alertas, métricas, reversión, restauración de respaldo y evidencias de operación sostenida.

## Puerta obligatoria de salida
No activar el ledger en producción sin resolución documentada y verificable de cada riesgo anterior. Mantener Finanzas Personales, cobros activos y rama main sin modificaciones hasta superar la puerta.

Comando de validación de rama: `npm ci && npm run gate`.
