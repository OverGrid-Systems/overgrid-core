#!/usr/bin/env bash
set -euo pipefail

node - <<'NODE'
const fs=require("fs");
const {spawnSync}=require("child_process");

const spec=JSON.parse(fs.readFileSync("core/spec/golden_hashes_v0.json","utf8"));
if(!spec || spec.version!=="golden_hashes_v0" || !spec.golden) {
  console.error("BAD_GOLDEN_HASHES_V0_SPEC");
  process.exit(1);
}

const entry=spec.golden["rts_bundle_v0"];
if(!entry || typeof entry!=="object" || typeof entry.expectedFinalChainHash!=="string") {
  console.error("BAD_GOLDEN_HASHES_V0_RTS_ENTRY");
  console.error("got", entry);
  process.exit(1);
}

const expected=entry.expectedFinalChainHash;

// نفّذ السكربت الحقيقي الذي ينتج Final ChainHash
const run=spawnSync("bash", ["scripts/ci_verify_rts_bundle_v0.sh"], {encoding:"utf8"});
const out=(run.stdout||"")+(run.stderr||"");
if(run.status!==0){
  console.error("BAD_RTS_BUNDLE_V0_SCRIPT");
  console.error(out);
  process.exit(1);
}

const m=out.match(/^Final ChainHash:\s*([0-9a-f]+)\s*$/m);
if(!m){
  console.error("BAD_RTS_BUNDLE_V0_OUTPUT");
  console.error(out);
  process.exit(1);
}
const got=m[1];

if(got!==expected){
  console.error("BAD_RTS_BUNDLE_V0_GOLDEN_CHAINHASH");
  console.error("expected", expected);
  console.error("got     ", got);
  process.exit(1);
}

console.log("OK_RTS_BUNDLE_V0_GOLDEN_CHAINHASH", got);
NODE
