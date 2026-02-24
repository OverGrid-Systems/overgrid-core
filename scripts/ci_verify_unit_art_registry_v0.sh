#!/usr/bin/env bash
set -euo pipefail

node scripts/gen_unit_art_registry_v0.cjs >/dev/null
node scripts/gen_unit_art_registry_hash_v0.cjs >/dev/null

node - <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const path=require("path");

function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function listJson(dir){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).map(f=>path.join(dir,f));
}

// hash verify
const hspec = readJson("core/spec/unit_art_registry_hash_v0.json");
const data = fs.readFileSync(hspec.file);
const h = crypto.createHash("sha256").update(data).digest("hex");
if(h !== hspec.sha256){
  console.error("UNIT_ART_REGISTRY_HASH_MISMATCH");
  console.error("EXPECTED", hspec.sha256);
  console.error("ACTUAL  ", h);
  process.exit(1);
}

// 1:1 cross-check against units
const unitFiles = listJson("core/data/units");
const artFiles  = listJson("core/data/unit_art");

const unitIds = new Set();
for(const f of unitFiles){
  const u = readJson(f);
  if(u && u.version === "unit_v0") unitIds.add(u.unitId);
}

const artIds = new Set();
for(const f of artFiles){
  const a = readJson(f);
  if(a && a.version === "unit_art_v0") artIds.add(a.unitId);
}

// every unit has art
for(const id of unitIds){
  if(!artIds.has(id)){
    console.error("MISSING_UNIT_ART_FOR_UNIT", id);
    process.exit(1);
  }
}
// every art refers to unit
for(const id of artIds){
  if(!unitIds.has(id)){
    console.error("UNIT_ART_REF_UNKNOWN_UNIT", id);
    process.exit(1);
  }
}

console.log("OK_UNIT_ART_REGISTRY_V0");
NODE
