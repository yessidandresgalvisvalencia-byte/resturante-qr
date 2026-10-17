# GRUK Finanzas Personales V81 — Registro de riesgos de dependencias

Fecha de diagnóstico: 2026-10-17. Fuente: workflow **Finanzas Personales V81 - Precision e Integridad**, commit `350018dd`, paso `npm audit --omit=dev --json`.

## Resultado confirmado

15 paquetes con alertas: 1 crítica, 8 altas, 5 moderadas y 1 baja. Es un análisis del árbol de dependencias del repositorio compartido, **no** una prueba de explotación de GRUK Finanzas Personales.

| Paquete | Severidad | Dependencia directa | Prioridad |
| --- | --- | --- | --- |
| proxy-addr | crítica | no | P0: identificar versión, ruta transitiva y parche |
| axios | alta | sí | P1: comprobar uso y actualizaciones compatibles |
| multer | alta | sí | P1: revisar endpoints que reciben archivos |
| engine.io | alta | no | P1: revisar cadena de socket.io |
| form-data | alta | no | P1: revisar cadena de axios |
| hoek | alta | no | P1: revisar cadena de joi |
| path-to-regexp | alta | no | P1: revisar cadena de express |
| socket.io-parser | alta | no | P1: revisar cadena de socket.io |
| ws | alta | no | P1: revisar cadena de WebSocket |
| joi | moderada | sí | P2: evaluar actualización compatible |
| mongoose | moderada | sí | P2: evaluar actualización compatible |
| follow-redirects | moderada | no | P2 |
| qs | moderada | no | P2 |
| socket.io-adapter | moderada | no | P2 |
| body-parser | baja | no | P3 |

## Versiones efectivamente instaladas

Extraídas del `package-lock.json` en la ejecución [39068688163](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39068688163), commit `3e4abc5`. **Todas las 15 alertas indicaron `fixAvailable: true` en npm audit**, pero esto no garantiza que cada corrección sea compatible con el sistema actual.

| Paquete | Versión instalada |
| --- | --- |
| proxy-addr | 2.0.7 |
| axios | 1.13.6 |
| multer | 2.1.1 |
| engine.io | 6.6.5 |
| form-data | 4.0.5 |
| hoek | 6.1.3 |
| path-to-regexp | 8.3.0 |
| socket.io-parser | 4.2.6 |
| ws | 8.18.3 |
| joi | 18.2.8 |
| mongoose | 9.2.4 |
| follow-redirects | 1.15.11 |
| qs | 6.15.0 |
| socket.io-adapter | 2.5.6 |
| body-parser | 2.2.2 |

**Acción prioritaria:** rastrear `proxy-addr@2.0.7` hasta el paquete padre, evaluar la versión reparada y revisar la confianza en encabezados de proxy. No asumir que actualizar solo este paquete es seguro: necesita validación de autenticación, controles de IP y limitación de peticiones.

## Procedimiento obligatorio para remediar

1. Capturar para cada alerta versión instalada, rango vulnerable, versión corregida y árbol de dependencias usando `npm ls <paquete>`, `npm audit --omit=dev --json` y `npm explain <paquete>`.
2. Comprobar si cada paquete se utiliza en GRUK Finanzas Personales, en GRUK Empresarial o en ambos. No asumir que la gravedad del paquete equivale a explotabilidad de la aplicación.
3. Preparar cambios compatibles en rama aislada; nunca ejecutar `npm audit fix --force` sin revisión, ni actualizar el lockfile compartido sin pruebas del sistema completo.
4. Exigir `npm ci`, auditoría sin hallazgos abiertos aplicables o excepciones justificadas y aprobadas, tests V81, pruebas MongoDB, GRUK Gate y smoke tests de Empresarial antes de fusionar.
5. No publicar una afirmación de seguridad absoluta. Registrar excepciones con propietario, alcance, mitigación y fecha de revisión.

## Evidencia verificable

- [CI V81 aprobada — commit 350018d](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39068547857)
- [Auditoría de seguridad fallida — mismo commit](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39068547831)

**Estado:** diagnóstico documentado; paquetes sin actualizar; producción sin modificar.
