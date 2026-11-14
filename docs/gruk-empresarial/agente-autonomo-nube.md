# GRUK Empresarial — agente autónomo en la nube (preparación segura)

Estado: **DISEÑO / NO ACTIVADO**. Este documento no configura un agente en ejecución ni autoriza despliegues.

## Fronteras de seguridad obligatorias

1. El agente opera **fuera** de los servicios web de producción de Render, en un entorno aislado y con presupuesto y tiempo de ejecución limitados.
2. Acceso GitHub de mínimo privilegio: repositorio `yessidandresgalvisvalencia-byte/resturante-qr`; lectura de código, escritura de ramas y PR; **sin** permisos de administración, secretos, entornos ni despliegue.
3. Nunca escribir directamente en `main`, hacer `push --force`, aprobarse a sí mismo ni fusionar sin CI verificado y las reglas de protección de ramas.
4. Nunca tocar los módulos de GRUK Finanzas Personales o Blushéa. Antes de cada PR, revisar el diff para asegurar alcance exclusivamente empresarial.
5. Tratar `GRUK_Documentos_Unificados_Plan_Maestro.docx` como backlog oficial de 77 requisitos P0–P3. Registrar ID, criterios de aceptación, rutas de código, tests, resultados CI, evidencia y bloqueos; **no** marcar completo sin evidencia.
6. Cada ciclo: sincronizar `main` y PR abiertos → escoger un bloque P0/P1 realizable → implementar en rama → ejecutar pruebas locales → abrir/actualizar PR → comprobar CI → registrar bloqueos. No abrir PR duplicados.
7. El agente no debe tener credenciales de Render ni de producción, ni acceso a datos reales de clientes. Usar datos sintéticos.
8. El despliegue final exige 77/77 criterios aceptados, E2E, revisión de seguridad, plan de rollback, servicio correcto y verificación explícita de `/health` HTTP 200.

## Bloqueos de producción verificados (2026-11-04)

Los servicios `resturante-qr-1` (ID `srv-d6n2kd75gffc73bq5oqg`) y `resturante-qr` (ID `srv-d6n2j07kijhs73e6jrjg`) tienen `autoDeploy=yes` desde `main`. **No fusionar PR a main hasta resolver esta configuración**.

- [Desactivar Auto-Deploy en resturante-qr-1](https://dashboard.render.com/web/srv-d6n2kd75gffc73bq5oqg)
- [Desactivar Auto-Deploy en resturante-qr](https://dashboard.render.com/web/srv-d6n2j07kijhs73e6jrjg)

En ambos servicios: Settings → Build & Deploy → Auto-Deploy → Off (verificar el valor guardado). Confirmar qué servicio es producción antes de cualquier despliegue.

## Secuencia de activación (requiere decisión del propietario)

1. Elegir proveedor y límite de gasto mensual del agente (infraestructura + uso de modelo).
2. Crear entorno aislado, usuario sin privilegios, almacenamiento persistente de estado, límites de CPU/memoria, alertas y apagado por presupuesto.
3. Crear una GitHub App con acceso mínimo; guardar el secreto en el gestor del proveedor, nunca en el repositorio ni en los logs.
4. Instalar un agente de programación compatible y un supervisor que reinicie fallos con backoff, registre logs y detenga bucles repetidos.
5. Probar en modo **solo lectura**, después habilitar PR de prueba sin merge. Exigir revisión humana inicial y CI.
6. Activar ciclos controlados solo cuando los límites y alertas funcionen. La automatización horaria de ChatGPT existente puede servir como supervisor, sin duplicar tareas.

## Criterios para declarar el agente operativo

- [ ] Proveedor, presupuesto y credenciales aprobados
- [ ] Entorno aislado creado, con límites y auditoría
- [ ] Protección de `main` y CI requeridos verificados
- [ ] Auto-Deploy de ambos Render desactivado y confirmado
- [ ] Ejecución de prueba: rama, commit, PR y CI verificados
- [ ] Recuperación de fallos y corte por presupuesto comprobados
- [ ] Sin cambios a producción ni a otros productos
