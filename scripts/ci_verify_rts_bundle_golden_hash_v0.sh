#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root even if caller changes CWD
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Optional: keep this (it verifies the golden file itself)
bash scripts/ci_verify_golden_hashes_v0.sh

node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");

const goldenPath = "core/spec/golden_hashes_v0.json";
if(!fs.existsSync(goldenPath)){
  console.error("MISSING_GOLDEN_HASHES_V0", goldenPath);
  process.exit(1);
}

let j;
try { j = JSON.parse(fs.readFileSync(goldenPath, "utf8")); }
catch(e){ console.error("BAD_GOLDEN_HASHES_V0"); process.exit(1); }

/*
Accept both schemas:
A) { "bundle_v1": "...", "rts_bundle_v0": "..." }
B) { "version":"golden_hashes_v0", "golden": { "bundle_v1":"...", "rts_bundle_v0":"..." } }
*/
const golden = (j && typeof j === "object" && j.golden && typeof j.golden === "object") ? j.golden : j;

if(j && typeof j === "object" && "version" in j && j.version !== "golden_hashes_v0"){
  console.error("BAD_GOLDEN_HASHES_V0");
  process.exit(1);
}

const expected = golden && golden.rts_bundle_v0;
if(typeof expected !== "string" || !expected.length){
  console.error("BAD_GOLDEN_HASHES_V0");
  process.exit(1);
}

const distPath = "core/dist/rts_bundle_v0.json";
if(!fs.existsSync(distPath)){
  console.error("MISSING_RTS_BUNDLE_V0_DIST", distPath);
  process.exit(1);
}

const buf = fs.readFileSync(distPath);
const got = crypto.createHash("sha256").update(buf).digest("hex");

if(got !== expected){
  console.error("BAD_RTS_BUNDLE_V0_GOLDEN_HASH");
  console.error("expected", expected);
  console.error("got     ", got);
  process.exit(1);
}

console.log("OK_RTS_BUNDLE_V0_GOLDEN_HASH", got);
NODE
