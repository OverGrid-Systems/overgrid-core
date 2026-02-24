#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

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
catch { console.error("BAD_GOLDEN_HASHES_V0"); process.exit(1); }

function pick(obj){
  if(!obj || typeof obj !== "object") return null;
  if(typeof obj.rts_bundle_v0 === "string") return obj.rts_bundle_v0;
  // common nestings
  if(obj.golden && typeof obj.golden === "object" && typeof obj.golden.rts_bundle_v0 === "string") return obj.golden.rts_bundle_v0;
  if(obj.hashes && typeof obj.hashes === "object" && typeof obj.hashes.rts_bundle_v0 === "string") return obj.hashes.rts_bundle_v0;
  // shallow search (depth 1) to be future-proof
  for(const k of Object.keys(obj)){
    const v = obj[k];
    if(v && typeof v === "object" && typeof v.rts_bundle_v0 === "string") return v.rts_bundle_v0;
  }
  return null;
}

const expected = pick(j);
if(!expected){
  console.error("BAD_GOLDEN_HASHES_V0");
  console.error("golden_keys", (j && typeof j === "object") ? Object.keys(j).join(",") : String(typeof j));
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
