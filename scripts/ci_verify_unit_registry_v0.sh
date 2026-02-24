#!/usr/bin/env bash
set -euo pipefail

node scripts/gen_unit_registry_v0.cjs >/dev/null
node scripts/gen_unit_registry_hash_v0.cjs >/dev/null

node - <<'NODE'
const fs=require("fs");
const a=JSON.parse(fs.readFileSync("core/spec/unit_registry_hash_v0.json","utf8"));
const crypto=require("crypto");
const data=fs.readFileSync(a.file);
const h=crypto.createHash("sha256").update(data).digest("hex");
if(h!==a.sha256){
  console.error("UNIT_REGISTRY_HASH_MISMATCH");
  console.error("EXPECTED", a.sha256);
  console.error("ACTUAL  ", h);
  process.exit(1);
}
console.log("OK_UNIT_REGISTRY_V0");
NODE
