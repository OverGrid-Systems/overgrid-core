#!/usr/bin/env bash
set -euo pipefail

node scripts/gen_unit_art_registry_v0.cjs >/dev/null
node scripts/gen_unit_art_registry_hash_v0.cjs >/dev/null

node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");

const regPath="core/dist/unit_art_registry_v0.json";
const specPath="core/spec/unit_art_registry_hash_v0.json";

if(!fs.existsSync(regPath)) { console.error("MISSING_REG", regPath); process.exit(1); }
if(!fs.existsSync(specPath)) { console.error("MISSING_SPEC", specPath); process.exit(1); }

const reg=fs.readFileSync(regPath);
const got=crypto.createHash("sha256").update(reg).digest("hex");

const spec=JSON.parse(fs.readFileSync(specPath,"utf8"));
if(!spec || spec.version!=="unit_art_registry_hash_v0") { console.error("BAD_SPEC_VERSION"); process.exit(1); }
if(spec.file!==regPath) { console.error("BAD_SPEC_FILE", spec.file); process.exit(1); }
if(spec.sha256!==got){
  console.error("UNIT_ART_REGISTRY_HASH_MISMATCH", "spec="+spec.sha256, "got="+got);
  process.exit(1);
}

console.log("OK_UNIT_ART_REGISTRY_HASH_V0", got);
NODE
