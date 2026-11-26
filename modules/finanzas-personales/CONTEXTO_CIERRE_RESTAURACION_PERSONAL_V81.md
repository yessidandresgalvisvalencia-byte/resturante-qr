# Contexto del cierre de restauración sin aplicar — r132

26/11/2026 Colombia. HEAD real inicial d76f7bdbc76b47dece9c351d5f2c5b2744cbca8a, árbol 5d16fdc7ff451d3dd2f55b977d32266edb466b36. Base feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e intacta. PR389 abierto/sin integrar. #407 es issue abierto: cuerpo y cuatro comentarios revisados sin evidencia operativa independiente nueva. CI inicial Gate45863969212/Seguridad45863968913/V8145863969058 success. Instrucciones, continuidad, matriz e informe r131 revisados. No AGENTS.md adicional en checkout. Fechas de ingreso/compra estricta ya completadas en lotes anteriores.

## Un bloque funcional y criterios de aceptación

Cierre explícito sin aplicar: contexto propio del acto HTTP, sin compensación financiera ficticia. POST conserva cuerpo/clave y exige la confirmación por cabecera existente; contexto solo del servidor y dueño JWT. Captura diferida ocurre después de validación pura y antes del primer escritor; se conserva una observación entre reintentos. Ausencia de configuración, dueño o dominio incorrectos fallan antes de escribir. Replay y GET del recibo verifican historia, no capturan ni requieren clave contextual actual.

El evento append-only de imputación incorpora auditoriaContexto opcional, privado (select:false, serialización minimizada), inmutable, dominio FP_CIERRE_RESTAURACION_CTX_MIN_V1. Firma HMAC y hash encadenado ligan el compromiso. Solo cierres sin aplicar admiten este dominio HTTP. Los siete lectores internos de imputación seleccionan el contexto para verificar; el historial público devuelve compromiso/resumen sin token de red, claveId, IP o user-agent crudos. No se reutiliza observación del pago/anulación/restauración aplicada. El peer socket no verifica al cliente detrás de proxy; dispositivo siempre declarado/sin verificar.

Ausencia del campo conserva bytes de firma/hash legados; no hay backfill ni migración ni índices/colecciones nuevos. Recibos mantienen contrato exacto y apuntan al hash firmado. El cierre solo agrega evento y cursor de imputación: no crea fuente, compensación, outbox ni débito/pago. La transacción conserva atomicidad. Adulterar u omitir contexto de un evento nuevo debe invalidar su lectura; jamás reparación automática.

## Validación

Seis pruebas nuevas y contratos relacionados:17/17. Módulo1077 casos/1068 aprobados/9 omisiones locales por integración no configurada; cero fallos/cancelaciones. ci:personal353 casos/349 aprobados/4 omisiones locales por Mongo no configurado; cero fallos/cancelaciones. Pruebas nuevas comparan bytes legados HMAC/hash, campo privado opcional, omisión/tamper/owner/dominio/fechas, captura antes de escritores, retry único, replay sin escribir y handler con capturadores separados. Contexto interno no HTTP se rechaza antes de escribir.

Mongo autorizado añade CUENTA/HISTORICO por rutas HTTP reales, pago450/capital400, ausencia de clave503 con snapshot intacto, dueño ajeno404/cuerpo forjado422, rollback después de insertar evento, carrera de cierre único, caja/fuentes/compensaciones/outbox/cursor financiero intactos, recibo/replay con y sin cabecera y sin clave, cuerpo cambiado409, compromiso público y adulteración administrativa sintética rechazada. Chromium amplía el cierre existente con503 previo, contexto HTTP privado/compromiso y replay/GET sin clave, conservando respuesta perdida, diario/copia/archivo y recuperación sin doble caja. Casos/timeouts/cuotas del navegador intactos. CI propia pendiente; no atribuir al nuevo código resultados del padre.

## Límites y checkpoint

Cobertura de este lote: cierre HTTP de restauración sin aplicar. No representa auditoría independiente ni certificación bancaria. Llamadas internas históricas sin contexto conservan formato previo. HMAC seudonimiza el peer; no es cifrado reversible de IP ni identidad de dispositivo. No cubre todos los intentos HTTP fallidos ni todos los actos de imputación ordinaria.

Bloqueos de producción de #407 continúan: custodio independiente real/anclas; copia independiente durable/retención/accesos, roles e índices reales, credenciales separadas, restauración aislada y RPO/RTO operativos; migración/configuración, dispositivos/Safari/carga, auditoría independiente y compatibilidad/informe final. Ensayo sintético no acredita producción ni independencia. No merge a feature, main intacta, cero Render y cero operaciones sobre datos reales/costos.

Siguiente paso: confirmar CI exacta de este código y cierre documental; después revisar auditoría contextual de decisiones ordinarias de imputación (aplicar/excluir/cierre) con sus contratos y dominio propios, sin reutilizar el dominio exclusivo de este cierre. Mantener originales y gates. Publicar con expected_sha y force:false; si HEAD cambió, detener publicación y reevaluar, sin sobrescribir.
