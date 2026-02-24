#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

function readJson(p){
  return JSON.parse(fs.readFileSync(p,"utf8"));
}

function stable(obj){
  if(Array.isArray(obj)) return obj.map(stable);
  if(obj && typeof obj==="object"){
    return Object.keys(obj).sort().reduce((o,k)=>{
      o[k]=stable(obj[k]); return o;
    },{});
  }
  return obj;
}

function loadDir(dir){
  return fs.readdirSync(dir)
    .filter(f=>f.endsWith(".json"))
    .sort()
    .map(f=>stable(readJson(path.join(dir,f))));
}

const units=loadDir("core/data/units");
const art=loadDir("core/data/unit_art");

const out={
  version:"unit_registry_v0",
  units,
  unit_art:art
};

const stableOut=stable(out);
const json=JSON.stringify(stableOut,null,2)+"\n";

fs.mkdirSync("core/dist",{recursive:true});
fs.writeFileSync("core/dist/unit_registry_v0.json",json);

const hash=crypto.createHash("sha256").update(json).digest("hex");
console.log("UNIT_REGISTRY_V0_HASH",hash);
