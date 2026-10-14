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

## Primera línea base de rendimiento (CI #1360, 2026-10-14)
- Auditoría de **10.000 asientos en memoria:** 69,53 ms, ejecución puntual en GitHub Actions.
- Servicio de auditoría con **1.000 asientos en MongoDB:** 102,68 ms, ejecución puntual en GitHub Actions con réplica local.
- Estas muestras no constituyen p95/p99, SLA, medición de un endpoint HTTP, ni predicción de tiempos en Render/MongoDB Atlas.
- No se ha medido aún la carga combinada de múltiples empresas, reintentos simultáneos, tamaño de documentos acumulado ni réplica distante.
- Es obligatorio ejecutar repeticiones con calentamiento, distribución de latencias, carga concurrente y telemetría antes de aprobar despliegue.

## Distribución inicial de latencias (CI #1362, 2026-10-14)
- Servicio `auditarLedgerEnMongo` con **1.000 asientos**, una iteración de calentamiento y 20 muestras secuenciales en réplica MongoDB local de GitHub Actions.
- **p50:** 21,35 ms; **p95:** 42,00 ms; **p99:** 50,88 ms (estimador nearest-rank; con n=20 el p99 es esencialmente el máximo).
- Fuente verificable: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/38626932577
- No es una prueba de concurrencia, de carga sostenida ni de replica MongoDB Atlas remota. Tampoco incluye el recorrido HTTP ni un compromiso de SLA.
- Mantener la puerta de producción cerrada hasta realizar pruebas representativas con más muestras, distintos tamaños de historial y carga.

## Concurrencia de auditoría (CI #1364, 2026-10-14)
- Ocho ejecuciones concurrentes de `auditarLedgerEnMongo` sobre la misma cadena de 500 asientos en el MongoDB local del runner.
- Tiempo total del lote: **142,84 ms**. Las ocho auditorías verificaron saldo 500 centavos, secuencia 500 y el mismo hash de cabecera.
- Evidencia: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/38628027867
- Es una muestra puntual sin escrituras concurrentes y sin distribución de latencia por solicitud. No representa el SLA bajo carga sostenida.

## Replay histórico por encima de 10.000 (CI #1379, 2026-10-14)
- CI #1379 completado satisfactoriamente: la prueba contra MongoDB registra previamente 10.001 asientos, audita la cadena y reproduce la primera operación sin cambiar el número de asientos ni el saldo.
- Evidencia: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/38631539149
- El CI #1378 fue cancelado; no cuenta como aprobación independiente.
- Capacidad actual configurada: hasta 100.000 asientos en la recuperación. **No significa** latencia aceptable para 100.000 ni validación de 100.000 en integración.
- Persisten límites O(n) de tiempo y de identificadores de operación retenidos en memoria, así como el bloqueo de historiales superiores a 100.000.

## Latencias de escritura ACID auditada (CI #1390, 2026-10-14)
- Veinte escrituras secuenciales `registrarMovimiento` con historial inicial de 1.000 asientos; cada escritura audita todo el historial dentro de su transacción snapshot.
- GitHub Actions con MongoDB local: p50 **57,32 ms**; p95 **106,03 ms**; p99 **340,48 ms** (nearest-rank, n=20; el p99 es el máximo observado).
- Tras las 20 escrituras se verificaron 1.020 asientos y saldo exacto de 1.020 centavos.
- Evidencia: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/38634860186
- El p99 observado no permite estimar el p99 poblacional. La variación exige repetir con muestras amplias, carga simultánea y MongoDB Atlas remoto. El costo O(n) de auditar íntegramente cada escritura sigue siendo un bloqueo de producción.

## Contrato criptográfico de ancla externa (desarrollo, 2026-10-14)
- Se incorporó `core/finance/v1000/anclaLedger.js` con firma y verificación Ed25519 para {empresaId, sedeId, secuencia, saldoCentavos, hashUltimo, emitidoEn}; dominio y versión criptográfica explícitos.
- El contrato **aún no publica anclas en almacenamiento independiente e inmutable**, ni las verifica durante las escrituras; **no constituye seguridad externa desplegada**.
- Condiciones para activarlo: custodiar llave privada fuera de MongoDB y de los servidores con permisos de escritura al ledger; publicar y retener anclas en servicio WORM/append-only bajo separación de privilegios; verificar monotonicidad de secuencia y continuidad del tramo desde el último anclaje antes de confiar en el saldo.
- Definir rotación de llaves, revocación, política de disponibilidad y periodo máximo entre anclajes, conciliación de anclas tras fallos y alertas de divergencia.
- **No desactivar auditoría íntegra de escrituras** hasta certificar el flujo integrado de anclaje externo y su modelo de amenazas. Un atacante con llave privada o privilegios en ambos dominios podría falsificar registros.
