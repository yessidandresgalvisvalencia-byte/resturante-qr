#!/usr/bin/env bash
# GRUK Enterprise: real data offsite archive and isolated restore.
# Requires private Google Drive OAuth and an independently retained age identity.
# This script has NO permission or command to modify MongoDB production.
set -Eeuo pipefail
umask 077
for command in mongodump mongosh mongorestore age docker sha256sum node; do
  command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }
done
for variable in GRUK_CATALOG_MONGO_URI GRUK_CATALOG_EXPECTED_HOST GRUK_MANIFEST_SIGNING_PRIVATE_KEY GRUK_MANIFEST_TRUSTED_KEYRING GRUK_ENTERPRISE_BACKUP_URI GRUK_DRIVE_OAUTH_CLIENT_ID GRUK_DRIVE_OAUTH_CLIENT_SECRET GRUK_DRIVE_OAUTH_REFRESH_TOKEN GRUK_DRIVE_BACKUP_FOLDER_ID GRUK_BACKUP_AGE_RECIPIENT GRUK_BACKUP_AGE_IDENTITY GITHUB_RUN_ID GITHUB_RUN_ATTEMPT; do
  [[ -n "${!variable:-}" ]] || { echo "Missing private configuration: $variable" >&2; exit 1; }
done
[[ "$GRUK_BACKUP_APPROVAL" == "RESPALDAR_SOLO_RESTAURANTE" ]] || { echo 'Backup confirmation invalid' >&2; exit 1; }
[[ "$GRUK_ENTERPRISE_DB" == "restaurante" && "$GRUK_ENTERPRISE_DB_CONFIRM" == "restaurante" ]] || { echo 'Enterprise DB scope invalid' >&2; exit 1; }
[[ "$GRUK_BACKUP_AGE_RECIPIENT" =~ ^age1[a-z0-9]{50,}$ ]] || { echo 'Invalid age public recipient' >&2; exit 1; }
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || { echo 'CI immutable run identity required' >&2; exit 1; }
[[ "${GRUK_CATALOG_ENABLED:-false}" == true ]] || { echo 'Independent catalog not authorized' >&2; exit 1; }
node -e 'try { require("./scripts/gruk/drive-catalog-connection").validateCatalogConnection({catalogUri:process.env.GRUK_CATALOG_MONGO_URI,sourceUri:process.env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:process.env.GRUK_CATALOG_EXPECTED_HOST}); require("mongoose"); } catch { console.error("GRUK_CATALOG_PREFLIGHT_FAILED"); process.exitCode=1; }'
tmp="$(mktemp -d)"
container="gruk-restore-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
file_name="gruk-restaurante-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.archive.age"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || :; rm -rf "$tmp"; }
trap cleanup EXIT
printf '%s\n' "$GRUK_BACKUP_AGE_IDENTITY" > "$tmp/identity"
chmod 600 "$tmp/identity"
# Confirm the supplied public/private key pair without exposing either.
echo 'GRUK_OFFSITE_KEY_PROBE' | age -r "$GRUK_BACKUP_AGE_RECIPIENT" |
  age -d -i "$tmp/identity" | grep -qx 'GRUK_OFFSITE_KEY_PROBE' ||
  { echo 'Encryption/decryption identity mismatch' >&2; exit 1; }
# Compare collection names, document counts and index specs after isolated restore.
# Use the same MONGO_URI for the production READ-ONLY access; no writes are issued.
read -r -d '' summary_js <<'JAVASCRIPT' || :
const d=db.getSiblingDB("restaurante");
const names=d.getCollectionInfos({type:"collection"}).map(x=>x.name).sort();
const result=names.map(name=>({
  name,
  count:d.getCollection(name).countDocuments({}),
  indexes:d.getCollection(name).getIndexes().map(i=>({
    key:i.key,unique:i.unique===true,partialFilterExpression:i.partialFilterExpression||null
  })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
}));
print(EJSON.stringify(result));
JAVASCRIPT
# mongosh may otherwise leak sanitized errors with credentials; never print raw output.
mongosh "$GRUK_ENTERPRISE_BACKUP_URI" --quiet --eval "$summary_js" > "$tmp/source-summary.json" 2>"$tmp/source-error"
[[ -s "$tmp/source-summary.json" ]] || { echo 'Production read-only summary empty' >&2; exit 1; }
# Only database 'restaurante' is dumped. No other tenant database is exported.
# The archive is encrypted in-stream; never save unencrypted production dumps to disk.
mongodump --uri="$GRUK_ENTERPRISE_BACKUP_URI" --db=restaurante --archive --gzip --quiet |
  age -r "$GRUK_BACKUP_AGE_RECIPIENT" -o "$tmp/archive.age"
[[ -s "$tmp/archive.age" ]] || { echo 'Encrypted archive missing' >&2; exit 1; }
sha256sum "$tmp/archive.age" | awk '{print $1}' > "$tmp/sha256"
node scripts/gruk/drive-backup-manifest.js create "$tmp/archive.age" "$file_name" "$tmp/manifest.json"
node scripts/gruk/drive-signed-receipt.js create "$tmp/archive.age" "$file_name" "$tmp/signed-receipt.json"
unset GRUK_MANIFEST_SIGNING_PRIVATE_KEY
node scripts/gruk/drive-catalog-runtime.js register "$tmp/archive.age" "$file_name" "$tmp/signed-receipt.json"
# Upload ciphertext only. A new Google Drive object is created for each run.
node scripts/gruk/p0-04-google-drive-encrypted-object.js upload "$tmp/archive.age" "$file_name" > "$tmp/drive-file-id"
drive_id="$(cat "$tmp/drive-file-id")"
[[ "$drive_id" =~ ^[A-Za-z0-9_-]{10,}$ ]] || { echo 'Drive object identifier invalid'; exit 1; }
node scripts/gruk/p0-04-google-drive-encrypted-object.js download "$drive_id" "$tmp/downloaded.age" > "$tmp/download-evidence"
sha256sum "$tmp/downloaded.age" | awk '{print $1}' > "$tmp/downloaded.sha256"
cmp -s "$tmp/sha256" "$tmp/downloaded.sha256" || { echo 'Offsite archive integrity mismatch' >&2; exit 1; }
node scripts/gruk/drive-backup-manifest.js verify "$tmp/downloaded.age" "$file_name" "$tmp/manifest.json"
env -u GRUK_MANIFEST_SIGNING_PRIVATE_KEY node scripts/gruk/drive-signed-receipt.js verify "$tmp/downloaded.age" "$file_name" "$tmp/signed-receipt.json"
node scripts/gruk/drive-catalog-runtime.js verify "$tmp/downloaded.age" "$file_name" "$tmp/signed-receipt.json"
docker run -d --name "$container" --network none mongo:7.0 >/dev/null
ready=0
for _ in $(seq 1 40); do
  if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -qx 1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Isolated restore container unavailable' >&2; exit 1; }
# Decrypt strictly on CI runner and stream directly into an offline isolated container.
# No --drop and no connection from the restore process to Atlas.
age -d -i "$tmp/identity" "$tmp/downloaded.age" |
  docker exec -i "$container" mongorestore --quiet --archive --gzip \
    --nsFrom='restaurante.*' --nsTo='restaurante_restore_drill.*'
# The restored collection's names differ only by database name.
docker exec "$container" mongosh --quiet --eval "${summary_js//getSiblingDB(\"restaurante\")/getSiblingDB(\"restaurante_restore_drill\")}" > "$tmp/target-summary.json" 2>"$tmp/restore-error"
cmp -s "$tmp/source-summary.json" "$tmp/target-summary.json" ||
  { echo 'Restore collection counts or index definitions differ (possibly concurrent production writes)' >&2; exit 1; }
# Never print bucket, object content, PII, credentials, or backup decryption material.
echo "GRUK_DRIVE_BACKUP_REAL_RESTORE_OK: database=restaurante; isolatedRestore=true; offsiteEncrypted=true; collectionCountsAndIndexesMatch=true; independentCatalogVerified=true"
echo "BACKUP_RUN_ID=${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
