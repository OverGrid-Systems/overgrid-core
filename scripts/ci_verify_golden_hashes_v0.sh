#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/golden_hashes_v0.json"
test -f "$SPEC" || { echo "MISSING_GOLDEN_HASHES_V0_SPEC"; exit 1; }

node - <<'NODE'
const fs=require("fs");

const specPath="core/spec/golden_hashes_v0.json";
const j=JSON.parse(fs.readFileSync(specPath,"utf8"));

function pick(obj, key){
  if(!obj || typeof obj!=="object") return undefined;
  // direct
  if(typeof obj[key]==="string") return obj[key];
  // nested common
  const v=obj[key];
  if(v && typeof v==="object"){
    if(typeof v.expectedFinalChainHash==="string") return v.expectedFinalChainHash;
    if(typeof v.expectedSha256==="string") return v.expectedSha256;
    if(typeof v.sha256==="string") return v.sha256;
    if(typeof v.expected==="string") return v.expected;
    if(typeof v.hash==="string") return v.hash;
    if(typeof v.digest==="string") return v.digest;
  }
  // expected bucket
  if(obj.expected && typeof obj.expected==="object" && typeof obj.expected[key]==="string") return obj.expected[key];
  if(obj.expected && typeof obj.expected==="object"){
    const vv=obj.expected[key];
    if(vv && typeof vv==="object"){
      if(typeof vv.expectedFinalChainHash==="string") return vv.expectedFinalChainHash;
      if(typeof vv.sha256==="string") return vv.sha256;
      if(typeof vv.expectedSha256==="string") return vv.expectedSha256;
    }
  }
  return undefined;
}

const bundle = pick(j,"bundle_v1");
const rts    = pick(j,"rts_bundle_v0");

const isHex = (s)=> typeof s==="string" && /^[0-9a-f]+$/i.test(s);

if(!isHex(bundle) || !isHex(rts)){
  console.error("BAD_GOLDEN_HASHES_V0_SPEC");
  console.error("bundle_v1=", bundle);
  console.error("rts_bundle_v0=", rts);
  process.exit(1);
}

console.log("OK_GOLDEN_HASHES_V0_SPEC");
console.log("OK_GOLDEN_bundle_v1", bundle);
console.log("OK_GOLDEN_rts_bundle_v0", rts);
NODE
