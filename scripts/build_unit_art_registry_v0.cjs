#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

function stable(x){
  if(x===null || typeof x!=="object") return x;
  if(Array.isArray(x)) return x.map(stable);
  const out={};
  for(const k of Object.keys(x).sort()) out[k]=stable(x[k]);
  return out;
}
function readJson(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }
function loadDir(dir){
  const files = fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort();
  return files.map(f=>stable(readJson(path.join(dir,f))));
}

const unitArt = loadDir("core/data/unit_art");

const out = {
  version: "unit_art_registry_v0",
  generatedFrom: "core/data/unit_art/*.json",
  count: unitArt.length,
  unitArt
};

const json = JSON.stringify(stable(out), null, 2) + "\n";
fs.mkdirSync("core/dist",{recursive:true});
fs.writeFileSync("core/dist/unit_art_registry_v0.json", json);

const hash = crypto.createHash("sha256").update(json).digest("hex");
console.log("UNIT_ART_REGISTRY_V0_HASH", hash);
