'use strict';
// GRUK Empresarial: supervisor de solo lectura. Nunca modifica código ni despliega.
const https = require('node:https');
const fs = require('node:fs');
const assert = require('node:assert/strict');

function requestJson(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.github.com', path,
      headers: {
        'User-Agent': 'gruk-enterprise-audit',
        'Accept': 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 15000,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; if (body.length > 2_000_000) req.destroy(new Error('Response too large')); });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`GitHub HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('GitHub timeout')));
    req.on('error', reject);
  });
}
function summarize(prs) {
  assert.ok(Array.isArray(prs));
  const lines = ['# GRUK Empresarial — auditoría de PR (solo lectura)', '', `PR abiertos inspeccionados: ${prs.length}`, ''];
  for (const pr of prs) {
    const safeTitle = String(pr.title || '').replace(/[\r\n|]/g, ' ').slice(0, 120);
    const sha = String(pr.head?.sha || '').slice(0, 12);
    lines.push(`- #${pr.number} ${safeTitle} — ${pr.draft ? 'borrador' : 'revisión'} — ${sha} — ${pr.html_url}`);
  }
  lines.push('', '> Este informe NO acredita CI, criterios de aceptación, integraciones ni despliegue.');
  return lines.join('\n') + '\n';
}
async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!/^[-\w]+\/[-\w.]+$/.test(repo || '')) throw new Error('Invalid GITHUB_REPOSITORY');
  const [owner, name] = repo.split('/');
  const prs = await requestJson(`/repos/${owner}/${name}/pulls?state=open&per_page=100`, process.env.GITHUB_TOKEN);
  const report = summarize(prs);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  process.stdout.write(report);
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
module.exports = { summarize };
