# GRUK Empresarial — Activación segura de Codex programado

Workflow: `.github/workflows/gruk-scheduled-word-audit.yml`, integrado con la
auditoría del Word. Programaciones GitHub: :00, :20, :25, :30, :35, :40,
:45, :50 y :55 de cada hora (UTC, igual minuto en Colombia). Las tareas
ChatGPT de :05, :10 y :15 son independientes.

## Acción obligatoria del propietario del repositorio
En **Settings → Secrets and variables → Actions → New repository secret**:

1. `OPENAI_API_KEY`: clave de API de OpenAI con presupuesto y límites de gasto;
   la suscripción de ChatGPT no es una clave de API.
2. `GRUK_PR_TOKEN`: token fine-grained limitado **solo** al repositorio
   `yessidandresgalvisvalencia-byte/resturante-qr`, con **Contents:
   read/write** y **Pull requests: read/write**. Conservarlo como secreto;
   nunca introducirlo en chat, archivos o logs. Es necesario para que los
   PR creados por el bot disparen sus controles de GitHub Actions, cosa
   que un PR creado con el `GITHUB_TOKEN` habitual no hace.
3. Comprobar que GitHub Actions y los PR están permitidos para este repo y
   que existe cuota disponible de Actions/API; revisar gastos y límites.

Sin los dos secretos, `codex-propose` **fallará de forma explícita** y
no generará commits ni PR: no se considera configurado operativamente.

## Gobierno y límites

- Codex recibe `contents: read`, sandbox `:workspace`, prompt del Word,
  y NO recibe el token de PR ni acceso a Render.
- Toda propuesta debe alterar código de directorios permitidos Y añadir
  prueba `test/gruk/*.test.js`.
- Un job distinto ejecuta sintaxis, unitarios e integración con MongoDB
  SIN credenciales.
- Solo después de esas pruebas, un tercer job usa `GRUK_PR_TOKEN` para
  crear/actualizar un **PR borrador** en rama fija. No fusiona `main`.
- Los requisitos 77/77, aprobación de seguridad, reversiones y producción
  deben verificarse independientemente: **no hay deploy automático**.
- Los cron de GitHub son best-effort: pueden atrasarse o saltarse ventanas.
  Corridas de hasta 45 minutos más pruebas no garantizan un bloque cada
  cinco minutos; evitar saturación y facturación inesperada.
- No editar los proyectos GRUK Personal ni Blushea.

Tras configurar los secretos, ejecutar manualmente **Run workflow** del
workflow `GRUK Scheduled Word 77 Audit` y comprobar 3 jobs
(`codex-propose`, `verify-proposal`, `publish-pr`), PR borrador y
CI de ese PR. Una ejecución sin cambios legítimos puede terminar sin PR;
no representa un error ni un bloque completado.
