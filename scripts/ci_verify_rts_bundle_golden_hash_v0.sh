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

const keys = (j && typeof j === "object") ? Object.keys(j) : [];
function asHash(v){
  if(typeof v === "string") return v;
  if(v && typeof v === "object"){
    for (const k of ["sha256","hash","value","expected","hex"]) {
      if(typeof v[k] === "string") return v[k];
    }
  }
  return null;
}

let expected = asHash(j?.rts_bundle_v0)
  ?? asHash(j?.golden?.rts_bundle_v0)
  ?? asHash(j?.hashes?.rts_bundle_v0);

if(!expected){
  console.error("BAD_GOLDEN_HASHES_V0");
  console.error("golden_keys", keys.join(",") || "<none>");
  console.error("rts_bundle_v0_type", typeof (j && j.rts_bundle_v0));
  console.error("rts_bundle_v0_value", JSON.stringify(j && j.rts_bundle_v0));
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
