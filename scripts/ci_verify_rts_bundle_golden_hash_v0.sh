#!/usr/bin/env bash
set -euo pipefail

# 1) اقرأ expected من spec
node - <<'NODE' > /tmp/expected_rts_bundle_v0_hash.txt
const fs=require("fs");
const p="core/spec/golden_hashes_v0.json";
if(!fs.existsSync(p)){ console.error("MISSING_GOLDEN_HASHES_V0", p); process.exit(1); }
const j=JSON.parse(fs.readFileSync(p,"utf8"));
if(!j || j.version!=="golden_hashes_v0" || !j.golden){ console.error("BAD_GOLDEN_HASHES_V0"); process.exit(1); }
const v=j.golden["rts_bundle_v0"];
if(typeof v!=="string" || !v.length){ console.error("MISSING_GOLDEN_rts_bundle_v0"); process.exit(1); }
process.stdout.write(v);
NODE

EXPECTED="$(cat /tmp/expected_rts_bundle_v0_hash.txt)"

# 2) شغّل verify الحالي وخذ Final ChainHash
LOG_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
LOG="$LOG_BASE/rts_bundle_v0_verify.log"

bash scripts/ci_verify_rts_bundle_v0.sh | tee "$LOG" >/dev/null

GOT="$(rg -n '^Final ChainHash:\s+' "$LOG" | tail -n 1 | perl -pe 's/^.*Final ChainHash:\s+//; s/\s+$//')"

if [[ -z "${GOT:-}" ]]; then
  echo "MISSING_FINAL_CHAINHASH_RTS_BUNDLE_V0"
  exit 1
fi

if [[ "$GOT" != "$EXPECTED" ]]; then
  echo "RTS_BUNDLE_GOLDEN_HASH_MISMATCH_V0 got=$GOT want=$EXPECTED"
  exit 1
fi

echo "OK_RTS_BUNDLE_GOLDEN_HASH_V0 $GOT"
