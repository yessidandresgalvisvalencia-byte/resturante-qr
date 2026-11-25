#!/usr/bin/env bash
set -euo pipefail
umask 077
tmp=$(mktemp -d)
pid=
cleanup(){ if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT
export GRUK_NATIVE_BACKUP_ROOT="$tmp/vault"
export GRUK_STORAGE_SIGNING_KEY_FILE="$tmp/key"
export GRUK_STORAGE_PORT=18787
node -e 'require("node:fs").writeFileSync(process.env.GRUK_STORAGE_SIGNING_KEY_FILE,require("node:crypto").randomBytes(32),{mode:0o600})'
token(){ node -e 'console.log(require("./scripts/gruk/native-storage-auth").issue(require("node:fs").readFileSync(process.env.GRUK_STORAGE_SIGNING_KEY_FILE),process.argv[1]))' "$1"; }
start(){
 : > "$tmp/log"
 node scripts/gruk/native-storage-service.js > "$tmp/log" 2>&1 & pid=$!
 for i in {1..50}; do
   kill -0 "$pid"
   if grep -q GRUK_STORAGE_LOCAL_READY "$tmp/log"; then return; fi
   sleep .1
 done
 return 1
}
age-keygen -o "$tmp/identity" 2>/dev/null
printf 'GRUK restart fixture\n' > "$tmp/plain"
age -r "$(age-keygen -y "$tmp/identity")" -o "$tmp/input.age" "$tmp/plain"
start
url="http://127.0.0.1:$GRUK_STORAGE_PORT/v1/backups/gruk-restaurante-2-1.archive.age"
curl --fail --silent --show-error --max-time 10 -X PUT -H "Authorization: Bearer $(token backup:write)" --data-binary @"$tmp/input.age" "$url" > "$tmp/receipt"
sha=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1])).sha256)' "$tmp/receipt")
kill "$pid"; wait "$pid"; pid=
start
curl --fail --silent --show-error --max-time 10 -H "Authorization: Bearer $(token backup:read)" -H "X-Backup-Sha256: $sha" "$url" > "$tmp/recovered.age"
age -d -i "$tmp/identity" -o "$tmp/recovered" "$tmp/recovered.age"
cmp "$tmp/plain" "$tmp/recovered"
echo GRUK_STORAGE_RESTART_RECOVERY_OK
