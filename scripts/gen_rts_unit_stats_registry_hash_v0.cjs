#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const candidates = [
  "core/spec/rts_unit_stats_registry_v0.json",
  "core/spec/rts_unit_stats_registry.json",
  "core/spec/rts_unit_stats_v0.json",
  "core/spec/rts_unit_stats.json",
  "core/spec/rts_units_stats_registry_v0.json",
  "core/spec/rts_unit_registry_stats_v0.json"
];

function sha256File(p){
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

let picked = null;
for(const rel of candidates){
  const abs = path.resolve(process.cwd(), rel);
  if(fs.existsSync(abs)){
    picked = rel;
    break;
  }
}

if(!picked){
  console.error("MISSING_RTS_UNIT_STATS_REGISTRY_FILE");
  console.error("Tried:", candidates.join(", "));
  process.exit(1);
}

const got = sha256File(picked);
process.stdout.write(got);
