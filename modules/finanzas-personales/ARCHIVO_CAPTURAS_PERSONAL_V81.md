# Archivo recuperable de capturas — r82

## Alcance y plan

Base feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e. PR #389 abierto, integración integration/fp-hormiga-clasificacion-credito-v81, padre comprobado e7dd79d4700b41d4de9a76691a8eebbd479d8684, árbol a21c8082dcd13ffb1c3d48c2ba465978b8681d6b. #407 es una incidencia abierta. Un bloque funcional: conservar páginas cerradas de capturas, consultarlas e incluirlas en copia/recuperación cifrada. No cambia cálculos, servidor, fuentes MongoDB, otros productos ni gates.

El pendiente de gastoInteligentePersonal.service.js ya consta resuelto en CONTINUIDAD_V81.md (lote inicial: próximo ingreso futuro válido, conciliación estricta, fallo FALTAN_DATOS); no se repite esa implementación.

## Criterios y comportamiento

| Criterio | Implementación / comprobación |
| --- | --- |
| Archivo explícito | Solo 1–100 entradas CONFIRMADA; exige confirmación y plan ligado a dueño, cantidad y SHA256 de raíz exacta. Rechaza pendientes/vacío/plan desactualizado/sesión cambiada |
| Conservar antes de liberar | Guarda página original en gruk.fp.capturas.v81:usuario:archivo:SHA, verifica lectura y después publica nueva raíz. Conserva texto sin enviar; no borra claves ni archivos |
| Fallo parcial recuperable | Cuota/escritura ignorada no libera lista. Si solo se guardó página, reintento reutiliza ese original; conflicto nunca lo reemplaza |
| Capacidad acotada | 100 entradas activas + hasta 20 páginas de 1–100 cerradas, máximo 2100 entradas. No hay poda ni rotación automática; límite bloquea nuevo archivo |
| Integridad local | Referencias en orden con prefijo completo, sin claves repetidas entre páginas, hash de original y recibos ligados a cuerpo/canal/clave. Faltantes o alterados bloquean archivo, exportación y consulta verificable |
| Consulta accesible | Ver capturas archivadas muestra solicitudes y recibos originales con textContent, details y texto adaptable. No interpreta HTML ni consulta/escribe finanzas; no presenta respuestas guardadas como asesoría actual |
| Copia portable compatible | Sin páginas mantiene FP_CAPTURAS_LOCAL_V1; con páginas usa V2 e incluye originales exactos. Mismo cifrado AES-GCM/PBKDF2, sin alternativa débil; acepta V1 anterior |
| Recuperación sin pérdidas | Verifica dueño/tipo/referencias/huellas/recibos, escribe páginas y acuse antes de activar raíz; no reemplaza otro diario. Reimportar copia conocida busca también entradas archivadas y conserva nuevas confirmaciones, texto y solicitudes |
| Aislamiento | Dueño con formato MongoDB 24hex; controles se bloquean durante archivo/copia/consulta y se limpian al salir. No hay llamadas copilot/aprobaciones al archivar o recuperar |

## Pruebas reproducibles

```bash
node --test test/finanzas-personales/archivoCapturasPersonal.test.js test/finanzas-personales/copiaCapturasPersonal.test.js test/finanzas-personales/capturaCopilotFrontend.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Entorno sintético autorizado del workflow V81, nunca producción:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Nueve pruebas nuevas cubren 100/101, reintento de archivo con nueva página activa, colisión con clave archivada, pendientes, límite20, cuota/escrituras ignoradas en página/raíz, corrupción/referencias, recuperación V2 y V1, fallos en páginas/acuse/raíz y conflictos, sesión/texto cambiados durante digest, confirmación UI y consulta literal/limpieza. Prueba anterior ajusta fixtures de usuario A/B a dueños 24hex; mantiene todas las aserciones. La primera suite detectó tres fallos por esos fixtures no válidos; no se debilita validación para aceptar identidades que no usa la aplicación.

Prueba nativa ampliada COPIA_CAPTURA_SIN_REINTERPRETAR_NI_APROBAR: después del POST real cuya respuesta se pierde y GET propio autenticado, archiva con UI, comprueba bytes originales y texto posterior, reimporta copia anterior sin volver pendiente, descarga copia con archivos y recupera en tercera pestaña/login real. Consulta locales, compara fuentes servidor y verifica ancho390 sin desborde. FP_ARCHIVO_CAPTURA registra resultados; ejecución pendiente del SHA publicado, sin darla por aprobada localmente.

## Evidencia previa cerrada

El HEAD padre e7dd79d tiene las tres CI exactas verdes: Gate 43297051471, Seguridad 43297051452, V81 43297051615. Job autorizado 131458033987: Mongo81/81 y navegador/backend15/15, cero fallos/omisiones/cancelaciones, FP_COPIA_CAPTURA completo. Esto cierra la comprobación documental pendiente de r81.

## Límites y siguiente paso

sessionStorage y páginas no son backup independiente ni defensa contra quien controla el navegador. Hash local no prueba custodia externa; recibos anteriores sin dueño explícito tampoco acreditan por sí solos titularidad. Consulta autenticada del servidor verifica dueño/fuente para capturas activas; los archivos muestran copias históricas locales, no vuelven a certificar respuestas o estado de borradores. Texto de páginas y recibos permanece local hasta exportación explícita cifrada. Un fallo de cuota conserva originales, pero no garantiza disponibilidad ni durabilidad del navegador.

Copia máxima: 8MiB de contenido, archivo cifrado máximo12MiB; con textos extensos puede alcanzarse antes de 2100 entradas. Se rechaza exceso sin recortar. No se ha acreditado un millón de usuarios, navegadores físicos ni rendimiento al máximo tamaño en todos los dispositivos. No hay promesa de recuperación garantizada.

Siguiente: revisar capacidad recuperable de calendario/imputaciones y continuidad de diarios; comprobar CI del SHA exacto. #407, custodio independiente real, backups independientes con retención/acceso/credenciales separadas y restauración operacional aislada/RPO-RTO, permisos/índices Mongo productivos, auditoría/dispositivos físicos/compatibilidad siguen pendientes. No integrar a feature ni desplegar Render hasta evidencias completas; no aumentar costos. Tarea activa, sin promesa de ejecución ininterrumpida.

## Validación local antes de publicación
Módulo: 732 pruebas, 723 aprobadas, cero fallos, nueve omisiones por servicios externos. ci:personal: 353/349/4, cero fallos, sintaxis completa aprobada. Dirigidas archivo+captura anterior: 13/13; copia+archivo+versionado:22/22 antes del ajuste de fixture. npm test general:800/729/64 fallos/7 omitidas; los fallos exigen TEST_MONGO_URI/GRUK_TEST_MONGODB_URI ausentes en este entorno. No se afirma Gate local aprobado ni se omiten esos tests; comprobar Gate remoto con su MongoDB. Node24 local frente Node20 CI.

## Resultado publicado y verificado

Código **0804290a294657a1b5b325e76d65875505ad35a2**, árbol **6c829552b7a313922f659310297446724d28a3c7**, nueve archivos personales con cotejo de árbol y actualización con lease.

- [Gate 43304439657](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43304439657): success.
- [Seguridad 43304439855](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43304439855): success.
- [V81 43304439682](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43304439682): success, ocho jobs aprobados.
- [Job autorizado 131483856586](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43304439682/job/131483856586): Mongo81/81 y navegador/backend15/15; cero fallos, cancelaciones u omisiones.

FP_ARCHIVO_CAPTURA acredita en datos sintéticos: original de página byte por byte, consentimiento de archivo, texto posterior conservado, consulta literal, descarga cifrada con archivos, tercera pestaña y login reales, recuperación exacta de raíz/páginas/texto, reimportación de copia anterior idempotente y ancho390 sin desborde. Cero POST, aprobaciones o nuevas consultas de respuestas por archivar/recuperar; las fuentes servidor permanecen intactas. FP_COPIA_CAPTURA anterior también completo. La prueba nativa pendiente indicada arriba queda resuelta para este SHA de código.

Dirigidas finales26/26; suite módulo y ci:personal conservan resultados indicados. El SHA documental descendiente debe obtener sus tres CI exactas antes del cierre, registradas en PR389. Publicado GitHub; sin integración a feature ni despliegue Render. Tarea recurrente comprobada habilitada, sin crear otra. Permanecen todos los límites y requisitos externos anteriores.
