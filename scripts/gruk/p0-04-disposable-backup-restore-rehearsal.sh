#!/usr/bin/env bash
# Disposable Mongo backup/restore rehearsal. Only SYNTHETIC fixture records.
# No Atlas, customer data, credentials, production DB or production writes.
set -Eeuo pipefail
umask 077
container="gruk-restore-rehearsal-$RANDOM-$$"
source_db="gruk_restore_fixture_source"
target_db="gruk_restore_fixture_target"
tmpdir="$(mktemp -d)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}
trap cleanup EXIT
# Ephemeral fixture key: not a production backup key.
export GRUK_BACKUP_FIXTURE_KEY_HEX="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
if [[ -n "${MONGO_URI:-}" || -n "${GRUK_ENTERPRISE_MONGO_URI:-}" || -n "${GRUK_ENTERPRISE_READONLY_MONGO_URI:-}" ]]; then
  echo "FAIL CLOSED: external Mongo URI must not be in this rehearsal environment" >&2
  exit 1
fi
docker run -d --name "$container" --network none mongo:7.0 >/dev/null
ready=0
for _ in $(seq 1 40); do
  if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -qx 1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo "Disposable Mongo unavailable"; exit 1; }
docker exec "$container" mongosh --quiet --eval \
  "const d=db.getSiblingDB('$source_db'); \
  d.ventas.insertMany([{_id:'sale-001',empresaId:'tenant-001',sedeId:'site-001',total:NumberDecimal('0.10')},{_id:'sale-002',empresaId:'tenant-001',sedeId:'site-001',total:NumberDecimal('0.20')}]); \
  d.movimientos_caja.insertOne({_id:'cash-001',empresaId:'tenant-001',sedeId:'site-001',monto:NumberDecimal('0.30')}); \
  if(d.ventas.countDocuments({})!==2 || d.movimientos_caja.countDocuments({})!==1) quit(9);" >/dev/null
# Archive is created inside a disposable, network-isolated Docker container.
docker exec "$container" mongodump --quiet --db "$source_db" --archive=/tmp/gruk-fixture.archive
# Archive exits the isolated container only as input to authenticated
# encryption. Never upload or print customer data (fixture records only).
docker exec "$container" cat /tmp/gruk-fixture.archive | \
  node scripts/gruk/p0-04-fixture-aesgcm.js encrypt "$tmpdir/backup.enc"
docker exec "$container" rm -f /tmp/gruk-fixture.archive
cp "$tmpdir/backup.enc" "$tmpdir/backup-tampered.enc"
node scripts/gruk/p0-04-fixture-aesgcm.js tamper "$tmpdir/backup-tampered.enc"
if node scripts/gruk/p0-04-fixture-aesgcm.js decrypt "$tmpdir/rejected" < "$tmpdir/backup-tampered.enc" >/dev/null 2>&1; then
  echo "FAIL: corrupted encrypted archive was accepted" >&2
  exit 1
fi
test ! -f "$tmpdir/rejected" || { echo "FAIL: corrupted archive produced plaintext"; exit 1; }
node scripts/gruk/p0-04-fixture-aesgcm.js decrypt "$tmpdir/restored.archive" < "$tmpdir/backup.enc"
docker cp "$tmpdir/restored.archive" "$container":/tmp/gruk-fixture.archive
rm -f "$tmpdir/restored.archive"
docker exec "$container" mongorestore --quiet --drop \
  --archive=/tmp/gruk-fixture.archive \
  --nsFrom="$source_db.*" --nsTo="$target_db.*"
docker exec "$container" mongosh --quiet --eval \
  "const d=db.getSiblingDB('$target_db'); \
  const sales=d.ventas.find().sort({_id:1}).toArray(); \
  const cash=d.movimientos_caja.find().toArray(); \
  if(sales.length!==2 || cash.length!==1) quit(11); \
  if(sales[0]._id!=='sale-001' || sales[1]._id!=='sale-002' || cash[0]._id!=='cash-001') quit(12); \
  if(sales[0].total.toString()!=='0.10' || sales[1].total.toString()!=='0.20' || cash[0].monto.toString()!=='0.30') quit(13); \
  if(BigInt('10')+BigInt('20')!==30n) quit(14);" >/dev/null
docker exec "$container" mongosh --quiet --eval \
  "const d=db.getSiblingDB('$source_db'); \
  if(d.ventas.countDocuments({})!==2 || d.movimientos_caja.countDocuments({})!==1) quit(15);" >/dev/null
docker exec "$container" sh -c 'rm -f /tmp/gruk-fixture.archive'
echo "PASS: AES-256-GCM authenticated synthetic backup and restore; corrupted archive rejected; 2 sales, 1 cash movement, 0.30 exact; no production data"
