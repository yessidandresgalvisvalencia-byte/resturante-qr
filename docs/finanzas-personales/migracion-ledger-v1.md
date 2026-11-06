# Importación legacy compatible con permisos restringidos

La migración `movimientos-v1` conserva su versión y la derivación HMAC de `externalIdHash`. Así, un reintento reconoce los asientos previamente importados. Usa `find` e `insert` sobre `fin_transacciones_personales`; no ejecuta actualizaciones, reemplazos, borrados ni upserts sobre esa colección.

Dentro de una transacción con lectura snapshot y confirmación majority:

1. Serializa la operación por usuario mediante el cursor de compatibilidad.
2. Lee hasta 5.000 fuentes legacy, con límite de tiempo por consulta.
3. Valida importes y rangos antes de insertar.
4. Compara cada asiento existente con los campos de su fuente importada. Si no coinciden, falla sin sobrescribirlo.
5. Inserta solamente los asientos faltantes y confirma el reporte en la misma transacción.

La reconciliación compara identidad, tipo, importe, textos importados, moneda, origen y fecha por registro, además de sumar con BigInt. Dos diferencias que se compensan en el saldo neto no producen un resultado reconciliado. Un error de persistencia revierte las inserciones y el reporte; no se escribe un reporte de error posterior que pudiera sobrescribir el éxito de otra operación concurrente.

## Límites del contrato

Los importes deben ser números enteros positivos representables exactamente. Los valores fraccionarios, cero o fuera de rango requieren revisión; no se redondean ni se convierten desde texto.

Se mantiene el mapeo histórico de `movimientos-v1`: usuario, tipo, monto, COP, concepto, categoría, subcategoría, fecha, origen de sistema y referencia HMAC. Esta versión no reconstruye automáticamente cuenta bancaria, pagos con crédito, recurrencia ni otros metadatos que el contrato anterior no importaba. Tampoco actualiza saldos de cuentas.

`RECONCILIADA` se refiere exclusivamente a los campos importados de las fuentes legacy **presentes en ese snapshot**. No certifica que nunca se hayan eliminado fuentes antiguas, que el historial esté completo o que coincida con un banco. La verificación compara asientos originales; las compensaciones posteriores permanecen en su propio historial y no se sobrescriben.

La migración exige los índices únicos reales de idempotencia y del reporte, sin índices sparse o parciales que debiliten su cobertura. Una consulta que exceda el límite falla sin resultados parciales.

CI ejecuta la migración contra un replica set MongoDB con autorización activada y un usuario que no tiene permiso `update` sobre los asientos. Comprueba repetición, concurrencia, aislamiento por usuario, detección de diferencias compensadas, rollback y rechazo cuando falta el índice de idempotencia. Esto no sustituye la validación de los datos y permisos de producción ni cierra el bloqueo #407.
