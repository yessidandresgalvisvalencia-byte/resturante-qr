"use strict";
// Fixture-only authenticated archive transport. Do not use as a production
// key-management system; this caps input size and uses ephemeral random keys.
const crypto = require("node:crypto");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const [,, mode, filepath] = process.argv;
if (!["encrypt", "decrypt", "tamper"].includes(mode) || !filepath)
  throw new Error("FIXTURE_MODE_INVALID");
if (mode === "tamper") {
  const data = fs.readFileSync(filepath);
  if (data.length < 50) throw new Error("FIXTURE_TOO_SHORT");
  data[data.length - 20] ^= 0x01;
  fs.writeFileSync(filepath, data, { mode: 0o600 });
  process.exit(0);
}
const keyString = process.env.GRUK_BACKUP_FIXTURE_KEY_HEX || "";
if (!/^[0-9a-f]{64}$/i.test(keyString)) throw new Error("FIXTURE_KEY_REQUIRED");
const key = Buffer.from(keyString, "hex");
const input = fs.readFileSync(0);
if (!input.length || input.length > 32 * 1024 * 1024) throw new Error("FIXTURE_SIZE_INVALID");
if (mode === "encrypt") {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const file = Buffer.concat([Buffer.from("GRUKFX01"), iv, cipher.getAuthTag(), encrypted]);
  fs.writeFileSync(filepath, file, { mode: 0o600 });
} else {
  assert.equal(input.subarray(0, 8).toString(), "GRUKFX01");
  if (input.length < 37) throw new Error("FIXTURE_ARCHIVE_TRUNCATED");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key,
    input.subarray(8, 20));
  decipher.setAuthTag(input.subarray(20, 36));
  const plain = Buffer.concat([decipher.update(input.subarray(36)), decipher.final()]);
  fs.writeFileSync(filepath, plain, { mode: 0o600 });
}
