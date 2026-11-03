"use strict";
// GRUK Empresarial: reject cross-product changes in a pull request.
// This guard is an additional CI check, not proof of runtime data isolation.
const { execFileSync } = require("node:child_process");

function forbiddenReason(file) {
  const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  if (normalized.startsWith("modules/finanzas-personales/") ||
      normalized.startsWith("public/finanzas-personales.") ||
      normalized.startsWith("public/finanzas-personales/") ||
      normalized.includes("/finanzas-personales/")) {
    return "GRUK Finanzas Personales";
  }
  if (/(^|\/)(blushea|blush[eé]a)(\/|\.|-|_ |$)/u.test(normalized) ||
      normalized.includes("blushea") || normalized.includes("blushéa")) {
    return "Blushéa";
  }
  return null;
}
function violations(files) {
  return files.filter(file => forbiddenReason(file)).map(file => ({ file, reason: forbiddenReason(file) }));
}
function changedFiles(base, head) {
  if (!/^[0-9a-f]{40}$/i.test(base) || !/^[0-9a-f]{40}$/i.test(head)) {
    throw new Error("Both PR base/head commit SHAs must be full 40-character hex strings");
  }
  const output = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, head], { maxBuffer: 10 * 1024 * 1024 });
  return output.toString("utf8").split("\0").filter(Boolean);
}
if (require.main === module) {
  try {
    const files = changedFiles(process.env.GRUK_PR_BASE_SHA || "", process.env.GRUK_PR_HEAD_SHA || "");
    const rejected = violations(files);
    if (rejected.length) {
      console.error("GRUK Empresarial PR modifies another product:");
      for (const item of rejected) console.error(`- ${item.file} (${item.reason})`);
      process.exitCode = 1;
    } else {
      console.log(`GRUK Empresarial scope guard: ${files.length} changed paths checked; no protected product paths modified.`);
    }
  } catch (error) {
    console.error(`GRUK Empresarial scope guard cannot verify PR: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { forbiddenReason, violations, changedFiles };
