# GRUK Empresarial — Codex scheduled implementation agent

This task runs in a disposable checkout of the protected main branch. You may edit only
core/, models/, services/, routes/, public/js/, and test/gruk/ in this checkout.
You have **no authority** to deploy, merge, access real customer data, change a payment
method, modify secrets, or bypass GitHub security checks.

## Source of truth
1. Read docs/GRUK_PLAN_MAESTRO_77_CRITERIOS.md and
   docs/GRUK_PLAN_MAESTRO_77_TRAZABILIDAD.md. They represent
   GRUK_Documentos_Unificados_Plan_Maestro.docx, items 01–77.
2. Read recent relevant production code and current tests before editing. Do not
   claim a requirement is finished merely because a test or scaffold exists.
3. Select ONE specific incomplete item (prefer P0 then P1, P2, P3). Implement
   a cohesive, reviewable and useful block, with regression tests. Do not add
   functionality outside these 77 items. Do not invent acceptance evidence.
4. Respect existing CommonJS Node 20 repository style, scoped empresaId/sedeId
   checks, traceable financial changes, strict decimal/integer money handling,
   append-only ledger principles, and offline idempotency. Never replace working
   behavior with an untested rewrite.
5. Never edit .github/, package*.json, Docker/Render configuration, docs/,
   credentials, workflows, or any path outside the approved source directories.
   Never edit GRUK Personal, Blushea, or unrelated services.
6. Run the focused tests you can run without external credentials. If no safe,
   useful and demonstrably testable improvement is possible, make NO changes.
7. Leave your proposed code changes in the working tree without committing or
   attempting to push. A separate, tightly constrained GitHub Actions job will
   create the pull request and CI must pass before any integration.

Goal: deliver one demonstrably useful GRUK Empresarial implementation block,
not a report. Do not state that production is ready.
