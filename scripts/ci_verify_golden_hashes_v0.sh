#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/golden_hashes_v0.json"
test -f "$SPEC"

node - <<'NODE'
const fs=require("fs");
const {execSync}=require("child_process");

const spec=JSON.parse(fs.readFileSync("core/spec/golden_hashes_v0.json","utf8"));

function run(name){
  const entry=spec[name];
  if(!entry) throw new Error("MISSING_ENTRY_"+name);

  const cmd=String(entry.script||"");
  const expected=String(entry.expectedFinalChainHash||"");
  if(!cmd) throw new Error("MISSING_SCRIPT_"+name);
  if(!/^[0-9a-f]{64}$/.test(expected)) throw new Error("BAD_EXPECTED_HASH_"+name);

  const out=execSync(cmd, {encoding:"utf8"});
  const m =
    out.match(/Final ChainHash:\s*([0-9a-f]{64})/i) ||
    out.match(/FINAL_CHAINHASH\s*([0-9a-f]{64})/i);

  if(!m){
    process.stderr.write("---- OUTPUT ("+name+") ----\n"+out+"\n");
    throw new Error("NO_CHAINHASH_IN_OUTPUT_"+name);
  }

  const got=m[1];
  if(got!==expected){
    throw new Error("GOLDEN_HASH_MISMATCH_"+name+"\nexpected="+expected+"\ngot="+got);
  }

  process.stdout.write("OK_GOLDEN_"+name+" "+got+"\n");
}

run("bundle_v1");
run("rts_bundle_v0");
NODE

echo "OK_GOLDEN_HASHES_V0"
