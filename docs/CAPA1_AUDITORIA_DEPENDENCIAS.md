# GRUK Capa 1 — Security gate triage (17 Oct 2026)

Evidence: GitHub Actions PR #96, commit c23113e, audit artifact ID 12107383817. The npm audit report on production dependencies contains **16 findings: 1 critical, 9 high, 5 moderate, 1 low**.

## Affected package names

- Critical: `proxy-addr`.
- High: `axios`, `code`, `engine.io`, `form-data`, `hoek`, `multer`, `path-to-regexp`, `socket.io-parser`, `ws`.
- Moderate: `follow-redirects`, `joi`, `mongoose`, `qs`, `socket.io-adapter`.
- Low: `body-parser`.

The report indicates automatic fixes available for most entries, but **not for `code` or `hoek`**. GitHub repository default-branch searches for direct `require("code")` and `require("hoek")` found no matches; this is not sufficient to prove that removal is safe.

## Release decision

**BLOCKED** until the high/critical vulnerabilities are remediated and the production dependency audit is green. Do not weaken or bypass the audit gate. Do not run `npm audit fix --force` against production without reviewing breaking changes, lockfile changes, and regression tests.

## Remediation sequence

1. Investigate direct usage of `code` (listed as a direct dependency) and transitive `hoek`. Remove `code` only after proving it is unused in application/runtime/test paths.
2. Resolve vulnerable transitive packages through supported dependency updates with a reproducible `package-lock.json`. Review affected API signatures before merge.
3. Run `npm ci`, full unit/integration tests, MongoDB replica set tests, Docker build, Compose validation and audit.
4. Keep PR #96 in draft and avoid changes to `main` until checks and release rollout conditions are satisfied.
5. Verify actual production /health after a separately approved deployment. CI success alone is not production evidence.

Note: npm audit findings are vulnerability advisories, not proof that GRUK was exploited.
