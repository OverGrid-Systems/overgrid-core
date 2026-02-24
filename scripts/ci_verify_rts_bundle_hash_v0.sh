#!/usr/bin/env bash
set -euo pipefail

node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");

const dist="core/dist/rts_bundle_v0.json";
const spec="core/spec/rts_bundle_hash_v0.json";

if(!fs.existsSync(dist)){ console.error("MISSING_RTS_BUNDLE_V0_DIST", dist); process.exit(1); }
if(!fs.existsSync(spec)){ console.error("MISSING_RTS_BUNDLE_HASH_V0_SPEC", spec); process.exit(1); }

const d=fs.readFileSync(dist);
const got=crypto.createHash("sha256").update(d).digest("hex");

const s=JSON.parse(fs.readFileSync(spec,"utf8"));
if(!s || s.version!=="rts_bundle_hash_v0" || typeof s.sha256!=="string"){
  console.error("BAD_RTS_BUNDLE_HASH_V0_SPEC");
  process.exit(1);
}

if(got !== s.sha256){
  console.error("RTS_BUNDLE_HASH_MISMATCH_V0", "got="+got, "want="+s.sha256);
  process.exit(1);
}

console.log("OK_RTS_BUNDLE_HASH_V0", got);
NODE
