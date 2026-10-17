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

## Origen confirmado del hallazgo crítico

La ejecución [39068842300](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39068842300), commit `d7cd274`, confirmó con `npm ls proxy-addr --all` y `npm explain proxy-addr` la única ruta instalada:

```text
restaurante@1.0.0
└── express@5.2.1
    └── proxy-addr@2.0.7
```

El proyecto declara `express@^5.2.1` y Express incorpora `proxy-addr@^2.0.7`. Se trata de una dependencia **transitiva del servidor compartido**. Antes de sustituir versiones, hay que determinar el primer parche disponible según el aviso [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), comprobar que el árbol resuelva a la versión parcheada y verificar los comportamientos de `trust proxy`, IP de cliente y rate limiting.

**No se ha confirmado exposición efectiva de la aplicación ni se ha aplicado todavía el parche.** El equipo no debe declarar cerrado el hallazgo solo por actualizar `package.json`: es necesario regenerar `package-lock.json`, ejecutar `npm ci`, pruebas financieras, pruebas empresariales y auditoría de dependencias.

## Parche identificado para proxy-addr

La alerta oficial [GHSA-jqcg-44mw-7w3h](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) indica que el rango vulnerable es `>=1.1.0 <2.0.8` y la primera versión corregida es **`proxy-addr@2.0.8`**. La versión instalada **2.0.7** está afectada. La vulnerabilidad afecta la interpretación de subredes IPv6 / IPv4-mapped en la configuración de proxies confiables, permitiendo falsificar IP de cliente mediante `X-Forwarded-For` bajo ciertas configuraciones. Esto puede debilitar rate limiting y controles basados en IP.

Express 5.2.1 declara `proxy-addr@^2.0.7`, rango semver que **admite 2.0.8**. Para remediar, se debe regenerar el lockfile con resolución de 2.0.8 o posterior compatible, comprobar `npm ls proxy-addr`, y correr todos los tests de ambos sistemas antes de fusionar cambios. **Aún no se ha cambiado `package-lock.json` ni desplegado nada**.

Referencia adicional: [historial de proxy-addr v2.0.8](https://github.com/jshttp/proxy-addr/blob/master/HISTORY.md).

## Parche probado y lockfile generado

En la ejecución [39069553725](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39069553725), commit `dcb8c54`, **los tres trabajos V81 fueron aprobados**: `test-v81`, `mongo-integration-v81` y `probar-parche-proxy-v81`. El último trabajo resolvió `proxy-addr@2.0.8` mediante `overrides`, ejecutó `npm ci`, comprobó la carga de Express y verificó la desaparición de la alerta de `proxy-addr` en la auditoría temporal.

GitHub Actions publicó el artefacto **`proxy-addr-208-lockfile-propuesto`** (ID `12114781624`) con los archivos `package.json` y `package-lock.json` resultantes, accesible desde la ejecución indicada. El artefacto es una **propuesta**, no una corrección fusionada.

**Pendiente para remediación definitiva:** revisar los cambios exactos del artefacto, incorporar ambos archivos en un commit consistente, ejecutar `npm ci`, `npm run gate`, las pruebas V81 y MongoDB, y volver a ejecutar `npm audit --omit=dev`. El workflow general de auditoría todavía falla en la rama actual.

## Corrección crítica aplicada y verificada en rama

La ejecución [39075066484](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39075066484), commit `0a108e6`, confirma que `npm ci` y los tres trabajos V81 pasan usando la configuración definitiva `overrides.proxy-addr=2.0.8` y `package-lock.json` actualizado.

La [auditoría de seguridad del mismo commit](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39075066427) registra **0 críticas, 8 altas, 5 moderadas y 1 baja (14 en total)**. Antes de la corrección había 1 crítica y 15 alertas en total. El problema crítico de `proxy-addr` dejó de aparecer en el análisis de producción.

**Importante:** esto confirma mitigación en la rama de GitHub, no que el cambio esté desplegado en Render. La auditoría general continúa fallando por las 14 alertas restantes; no declarar GRUK seguro para producción hasta completar la remediación y pruebas de regresión pertinentes.

## Parches HTTP probados y artefacto verificable

Ejecución [39075667793](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39075667793), commit `fe08da6`: cuatro trabajos correctos (`test-v81`, `mongo-integration-v81`, `probar-parche-proxy-v81` y `probar-parches-http-v81`). GRUK Gate también aprobó en el mismo commit.

El artefacto `parches-http-v81-lockfile-propuesto` (ID `12116852994`) contiene los archivos npm generados y probados en un runner desechable. Versiones verificadas al inspeccionar el artefacto:

| Paquete | Versión probada | Definición propuesta |
| --- | --- | --- |
| axios | 1.20.0 | `dependencies.axios=1.20.0` |
| multer | 2.4.0 | `dependencies.multer=^2.3.0` |
| form-data | 4.0.6 | `overrides.form-data=4.0.6` |
| proxy-addr | 2.0.8 | `overrides.proxy-addr=2.0.8` (ya aplicado en rama) |

El trabajo temporal confirmó ausencia de alertas npm para **axios, multer y form-data**, pero **no** ausencia de otras vulnerabilidades. Se requiere fusionar `package.json` **junto con su `package-lock.json` exacto** y repetir las validaciones. No se ha incorporado este paquete de parches HTTP al repositorio ni a producción.

## Parche HTTP integrado y auditado

Ejecución [39076080539](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39076080539) del commit `63cb6ee`: cuatro jobs V81 aprobados, incluyendo `npm ci` reproducible, MongoDB con transacciones y compatibilidad de parches HTTP.

La [auditoría de seguridad](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39076080621) del mismo commit contabiliza **0 críticas, 5 altas, 4 moderadas y 1 baja: 10 alertas totales**, frente a las 15 originales. Los cambios definitivos en la rama incluyen `axios@1.20.0`, `multer@2.4.0`, `form-data@4.0.6`, `follow-redirects@1.16.1` y `proxy-addr@2.0.8`, más dependencias transitivas compatibles.

**Riesgos pendientes:** identificar el conjunto exacto de las 10 alertas, sus rutas de dependencia y las versiones corregidas. GRUK Gate y pruebas compartidas deben seguir pasando. El parche no está desplegado en Render; no declarar auditoría cerrada.

## Ensayo compatible con cero hallazgos de producción

La ejecución [39076445015](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39076445015), commit `9b6203d`, aprobó los cinco trabajos V81, incluido `evaluar-remediacion-restante-v81`. En ese runner temporal, tras `npm audit fix --package-lock-only --ignore-scripts --omit=dev`, `npm ci`, análisis de sintaxis y pruebas financieras, **`npm audit --omit=dev --json` arrojó 0 críticas, 0 altas, 0 moderadas y 0 bajas**.

Artefacto de propuesta `remedicion-v81-lockfile-candidato`, ID `12117675285`, contiene la resolución ensayada. El resultado **no** corresponde aún a la rama ni producción: la auditoría normal del mismo commit siguió fallando con los hallazgos originales. Antes de aplicar el lockfile se debe contrastar su diferencia exacta, preservar integridad npm, comprobar `npm ci` y repetir toda CI (V81 y GRUK Gate).

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
