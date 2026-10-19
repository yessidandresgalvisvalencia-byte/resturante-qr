# GRUK Finanzas Personales — compatibilidad de dependencias V4

## Estado: bloqueado por deriva de main
Origen inicial de V4: `main=004720b27751aef4177996088ee6a6cbeae3d9a7`, `feature/finanzas-personales=142ef903677aa4891916944df70a0bf38e5dcb61`.

La primera ejecución de [GRUK Package Compatibility V4](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39194367040) finalizó correctamente: comparación de manifiestos, `npm ci --ignore-scripts` desde la base empresarial y comprobaciones de sintaxis.

### Diferencias directas
- `axios`: empresarial `^1.6.0`, personal `1.20.0`.
- `multer`: empresarial `^2.1.1`, personal `^2.3.0`.
- `nodemon`: exclusivo de las dependencias de desarrollo personales `^3.1.14`.
- Scripts exclusivos del producto personal: `audit:personal:mongo-privileges`, `build:personal`, `check:personal`, `ci:personal`, `postinstall`, `start:personal`, `test:finanzas-personales`, `test:personal:cadena-v81`, `test:personal:dinero-v81`, `test:personal:mongo-idempotencia`. Los scripts `check:syntax` y `dev` también difieren.

Se agregaron pruebas de regresión para comprobar la detección de nuevas diferencias; al repetir el workflow, este **falló de forma intencionada** porque `main` avanzó a `f64e508518e80f073429ba8b330e03d00fed78aa` (desde `004720b27751aef4177996088ee6a6cbeae3d9a7`). Evidencia: [ejecución 39194481082](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39194481082). No se deben cambiar las constantes esperadas a ciegas ni declarar aprobado un lockfile conjunto.

## Próximos criterios
El repositorio necesita una candidatura actualizada desde la punta vigente de `main` cuando se vaya a resolver realmente el paquete. Combinar scripts y dependencias en un archivo provisional, regenerar lockfile, ejecutar `npm ci` y **ambas suites de pruebas** antes de cualquier merge. No está hecho aún.

**No apto para fusión.** La rama personal productiva y la empresarial no fueron modificadas por esta tarea.
