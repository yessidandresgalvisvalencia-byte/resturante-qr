# GRUK Empresarial — evidencia de restauración P0-04

## Alcance de la prueba automatizada

El workflow `GRUK P0-04 Disposable Backup Restore Gate` inicia MongoDB 7 dentro de un contenedor **sin red**, inserta únicamente datos sintéticos (dos ventas 0,10 y 0,20 y un movimiento de caja 0,30), ejecuta `mongodump` y `mongorestore` hacia **otra base dentro del contenedor desechable**, verifica los documentos y montos exactos, y destruye el contenedor junto al archivo de respaldo mediante `trap`.

No usa conexión a Atlas, credenciales ni datos de clientes. No se carga ningún artefacto ni se expone archivo de respaldo. Esta prueba documenta que el mecanismo básico de exportación/restauración funciona **para una muestra sintética**, no que exista respaldo recuperable de los datos reales.

## Estado de datos reales

La auditoría monetaria en lectura de la base real `restaurante` pasó el 20 de noviembre de 2026 (GitHub run 44739381585), pero **no es un respaldo**. Atlas Cluster0 aparece en el plan Free. No se ha verificado una política de snapshots ni un almacenamiento de copia cifrada y externo.

## Requisitos para crear y certificar respaldo real

1. Aprobar destino de almacenamiento seguro fuera de MongoDB, cifrado antes de subir, rotación y retención; acceso restringido y claves gestionadas fuera del repositorio.
2. Ejecutar `mongodump` con acceso de lectura a `restaurante` y **no incluir** `gruk_finanzas_personales` ni otras bases. Evitar copiar el dump de clientes a artefactos públicos o almacenarlo sin cifrar.
3. Realizar restauración en clúster aislado con credenciales propias. No usar `mongorestore --drop` contra Atlas productivo.
4. Comparar colecciones y conteos, transacciones y totales por empresa/sede, índices, objetos referenciados, y una comprobación de servicio de aplicación con base restaurada; confirmar RPO/RTO y la recuperación de claves.
5. Documentar responsable, fecha, objeto de respaldo y prueba de restore (sin exponer datos de clientes), y aprobar migración y despliegue solo tras revisión independiente.

**Puerta:** no afirmar “backup real listo” o “restore de producción probado” por un gate sintético verde.
