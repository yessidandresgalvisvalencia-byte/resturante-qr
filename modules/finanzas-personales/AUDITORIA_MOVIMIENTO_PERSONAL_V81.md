# Auditoría propia de movimientos — r98

Corte: 18 de noviembre de2026 (Colombia). Base real b8117c54f93e58e8ae464d656bab0a43053f5536/árbol1fc612d768809c77143a729181f4afd757f99411 en integration/fp-hormiga-clasificacion-credito-v81. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e, sin merge. Gate44453879589, Seguridad44453879586 y V8144453879576 del padre success. #407 es issue abierto, mantiene bloqueo de liberación. Estos resultados no aprueban el siguiente SHA.

## Bloque y comportamiento

Un bloque funcional: consulta propia y vista de auditoría compensatoria desde cada movimiento del historial. Hace accesible la evidencia ya conservada en r97; no reemplaza la captura contextual pendiente de registros originales y demás flujos. Prioridad: consultar originales y decisiones sin repetir mutaciones financieras.

GET /transacciones/:id/auditoria requiere JWT/suscripción personales y devuelve no-store también ante401. Identidad de sesión, ID válido y consulta estricta pagina/headHash; no admite elegir dueño. Dentro de una transacción snapshot/primary, lee fuente propia y cadena COMPLETA/cursor mediante el verificador existente (máximo10000 eventos globales), comprueba semántica de compensaciones del movimiento frente a la fuente original y presenta20 eventos por página. No afirma verificar la fuente original de todos los demás movimientos: la verificación global cubre hashes/cursor, y la semántica/fuente es del movimiento elegido.

Página posterior exige headHash de la primera; si cambió cualquier evento de la cadena del dueño, devuelve409 y obliga a empezar de nuevo. No mezcla páginas de snapshots distintos como si fueran una única prueba. Fuente incompatible, delta adulterado, hash roto o cursor inconsistente fallan cerrado. No repara ni omite fuentes, y no interpreta anulaciones heredadas como historial verificable.

DTO incluye fuente original permitida, estado del movimiento en ese snapshot, secuencia/hash global y eventos con resumen/compromiso público. No expone contexto privado, token HMAC, IP cruda, User-Agent ni ID de clave. Lectura no necesita clave HMAC actual. Mantiene dominio y formato de eventos r97, sin reescribir hashes.

La vista Ver auditoría usa solo GET y textContent: original, antes/cambios, tipo/fecha/delta, referencia de restauración, contexto declarado y hash. Comprueba hashes públicos de los eventos mostrados; no tiene la cadena completa ni certifica custodia externa. En préstamos separa capital/pago real/delta. Si falla una página conserva lo ya mostrado y ofrece actualizar desde el inicio; no duplica filas al reconsultar. Respuestas/digests posteriores a cambio de sesión o revisión de búsqueda no repintan la vista. Logout/invalidador existente limpia el contenedor. No persiste ni poda diarios locales. Vista390px verificada en Chromium en el alcance descrito en el cierre.

No escribe cuentas, fuentes, eventos, cursor de coordinación ni Outbox. No representa saldo actual, Disponible Hoy ni confirmación bancaria. No crea un protocolo nuevo de recuperación de mutaciones con respuesta perdida; consulta auditoría ya registrada.

## Plan y criterios de aceptación

| Criterio | Verificación requerida |
| --- | --- |
| 1. Lectura autenticada | Dueño de JWT, ajeno/inexistente404, query estricta, no-store/401 y sin campos privados |
| 2. Integridad | Cadena global/cursor verificados, fuente/semántica propias, adulteración de otro movimiento detectada, fuente incompatible rechazada |
| 3. Paginación | Más de20 eventos, secuencias no necesariamente contiguas por movimiento, ancla obligatoria, cadena nueva409, reinicio explícito sin mezclar |
| 4. Conservación | Caja sintética83000 tras gasto corregido15000 y otro2000 desde100000; fotografía idéntica antes/después de GET, originales/eventos/cursor/Outbox intactos |
| 5. Fallos/privacidad | Lectura sin clave, hash falso/contexto privado rechazados, fallo de página conserva vista, sesión/digest tardío no repinta, XSS literal |
| 6. Integración | HTML/API/Mongo autorizado y Chromium390, hashes/antes/delta/contexto visibles, cero escrituras UI, pagina/409/refresco y aislamiento |
| 7. Trazabilidad | SHA/tree/lease, tres CI exactas, métricas de respaldo aislado y actualización de matriz/continuidad/siguiente paso |


## Cierre funcional verificado r98 — 18 de noviembre de2026

Código/pruebas538967b0b71606d63c7fff6fc8e78737aaf60319, árbol4f6434ca66ed6a2e996cb355388756b9bbd81fd5; padre b8117c54f93e58e8ae464d656bab0a43053f5536/árbol1fc612d768809c77143a729181f4afd757f99411. Ref de integración actualizada con expected_sha/force=false y árbol local/remoto igual; PR389 sigue abierto/no fusionado hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. Solo módulo/interfaz/pruebas personales. No hubo correcciones de fallos CI en este lote.

[Gate44456024897](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44456024897), [Seguridad44456024873](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44456024873) y [V8144456024884](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44456024884) success del SHA exacto; ocho jobs V81 aprobados. [Job135331116191](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44456024884/job/135331116191): Mongo91/91 y navegador/backend26/26, cero fallos/omisiones/cancelaciones. La instalación de Chromium demoró, pero terminó sin eliminar ni cambiar gates, timeouts o pruebas.

Mongo con rol restringido ensayó lectura de fuente propia y cadena completa en snapshot. Más de20 eventos del mismo movimiento con secuencias intercaladas por otro movimiento; páginas20+2, head global23 y fuente/estado coherentes. Lectura sin clave HMAC actual, resumen sin contexto privado/token/ID de clave/IP cruda y hash público recalculable. Dueño ajeno/inexistente404, queries con dueño inyectado/arrays/página inválida/sin ancla400; head antiguo409 tras nueva corrección, nueva primera página coherente y consulta concurrente con escritura ve snapshot completo anterior o posterior. Adulterar el hash de OTRO movimiento del mismo dueño hace fallar409 la auditoría seleccionada. Es una modificación administrativa de fixture sintética aislada, no permiso de aplicación ni reparación productiva.

Cuenta de ensayo100000, gasto10000 y otro2000 dejan88000; corrección del primero a15000 deja83000. Cambios posteriores de categoría tienen delta0. Cada conjunto de consultas compara fotografía completa de cuenta, fuentes, eventos, cursor (incluida revisión de coordinación) y Outbox: ninguna escritura por GET. Originales conservados. Endpoint verifica hashes/cursor globales y fuente/semántica del movimiento elegido, sin afirmar verificación de fuentes de todos los demás movimientos ni custodia independiente.

FP_AUDITORIA_MOVIMIENTO aprobó Chromium390/HTML/API/Mongo: login real, abrir Ver auditoría desde historial,20 de22 eventos, cambio sintético de categoría desde servidor que agrega un evento, siguiente página409 conservando los20 mostrados, actualización explícita y final23 de23. Cuatro GET de auditoría, cero POST/PATCH/DELETE financieros desde la vista, saldo83000 y fuente intactos después de cada lectura. Las fotografías posteriores al cambio sintético incluyen ese evento deliberado; no se afirma que el ensayo completo carezca de esa escritura de preparación. Literal <img> mostrado como texto sin nodo de imagen; contexto declarado sin verificar, capital/pago real/delta diferenciados en prueba pura de préstamos, sin IP/token en respuestas, ajeno404 y sin desbordamiento horizontal390px. No acredita Safari, dispositivo físico ni accesibilidad completa certificada.

Local final: módulo887casos/878aprobados/9omisiones/0fallos; ci:personal353/349aprobados/4omisiones/0fallos. Nuevos casos puros/handler/UI10/10; dirigida con versión/carga frontend14/14. Prueban páginas, fuente contradictoria, delta alterado aun con hash recalculado, DTO ajeno/privado/hash falso, conservación ante fallo, sesión cambiada durante HTTP y durante digest, texto literal y capital500/pago real1000/efecto1000 de anulación. Omisiones locales no sustituyen Mongo/Chromium autorizados. Ensayo local adicional con Express/router reales, sin conexión Mongo, comprobó GET sin sesión401 y Cache-Control no-store antes de autenticar; reproducer versionado en AUDITORIA_MOVIMIENTO_PERSONAL_V81.md. Auditoría estática sin patrones revisados de mutación; --enforce mantiene salida1 por evidencias externas reales pendientes #407. Gasto inteligente releído: fecha futura e importe exacto del ingreso, saldo/obligaciones conciliados y snapshot verificable continúan siendo requisitos; no se reimplementa trabajo ya completo.

Sin cambio de formato: backup sintético aisladoV27/44,7858documentos,7682718bytes, captura185ms, restauración866ms y edad1074ms; custodiaIndependiente=false/rpoProduccion=false. Mismas25 colecciones protegidas, sin colecciones/índices nuevos. Verifica BSON/índices/restauración en destino vacío aislado; no prueba semántica de cada registro, backup productivo independiente ni RPO/RTO operacionales. Sin provisión/migración/restauración de producción, TTL, poda, nueva retención automática o borrados añadidos.

Aceptación1–7 verificada dentro del alcance descrito; un bloque funcional de acceso a auditoría compensatoria propia, no un bloque por commit. El descendiente documental requiere sus tres CI; HEAD/runs finales quedan en pie PR389 e historial Git. Checkpoint: releer informe/matriz/continuidad, verificar HEAD remoto y CI antes de actualizar con lease; no depender del chat ni de temporales.

Siguiente bloque: captura contextual de registros originales y demás flujos, y resolución explícita de metas ambiguas mediante eventos y consentimiento conservando cada fuente, sin reparaciones/omisiones/conversiones automáticas. #407 sigue abierto: custodio independiente real/control separado; backup/restore operacional con destino/retención/acceso/credenciales independientes y RPO/RTO medidos; roles/índices/migración históricos productivos; claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente cuando corresponda. Sin merge a feature/main, despliegue Render, costos nuevos, otros productos o datos reales modificados. Sin certificaciones externas ni garantías absolutas.

## Operación y límites

Sin nuevas colecciones, índices o formato: backupV27/44 y política25 colecciones protegidas permanecen. Nuevos datos del ensayo son sintéticos; modificaciones administrativas de fixtures para probar adulteración no son reparación productiva ni permisos de aplicación. El respaldo BSON/índices de CI no prueba semántica de cada fuente ni backup independiente de producción.

#407 permanece abierto: custodio independiente real/control separado; backup/restore operacional con destino/retención/acceso y credenciales separados y RPO/RTO medidos; roles/índices/migración históricos productivos; claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente cuando corresponda. No desplegar hasta cumplir todos los criterios globales y compatibilidad operativa. Sin merge a feature/main, Render, costos nuevos, otros productos o información real modificada. Sin certificaciones externas ni garantías absolutas.

Siguiente: completar verificación del lote y cierre del SHA exacto; luego contexto de registros originales/demás flujos y resolución explícita de metas ambiguas, mediante eventos y consentimiento conservando fuentes. Releer HEAD remoto, CI, este documento, matriz y continuidad; no depender del chat ni de archivos temporales.

## Reproducción local de rechazo previo a autenticar

Desde la raíz del repositorio; no requiere abrir MongoDB ni elegir datos reales:

```sh
node - <<'JS'
const assert=require('node:assert/strict'),express=require('express');
(async()=>{const app=express();app.use('/api',require('./modules/finanzas-personales/routes'));const s=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});try{const r=await fetch('http://127.0.0.1:'+s.address().port+'/api/transacciones/'+ 'b'.repeat(24)+'/auditoria');assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/);}finally{await new Promise(r=>s.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
JS
```
