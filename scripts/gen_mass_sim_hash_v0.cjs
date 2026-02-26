#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

function sha256(buf){
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function walk(dir){
  let results = [];
  const list = fs.readdirSync(dir);
  for(const file of list){
    const p = path.join(dir,file);
    const stat = fs.statSync(p);
    if(stat.isDirectory()){
      results = results.concat(walk(p));
    } else if(p.endsWith(".md")){
      results.push(p);
    }
  }
  return results.sort();
}

function main(){
  const baseDir = "core/spec/mass_sim_v0";
  if(!fs.existsSync(baseDir)) throw new Error("MISSING mass_sim_v0: " + baseDir);

  const files = walk(baseDir);
  const hashes = [];

  for(const f of files){
    const content = fs.readFileSync(f);
    hashes.push(sha256(content));
  }

  const combined = sha256(Buffer.from(hashes.join("\n"), "utf8"));

  const out = {
    version: "mass_sim_hash_v0",
    files,
    sha256: combined
  };

  fs.writeFileSync(
    "core/spec/mass_sim_hash_v0.json",
    JSON.stringify(out, null, 2) + "\n",
    "utf8"
  );

  console.log("OK_MASS_SIM_HASH_V0_GEN", combined);
}

main();
