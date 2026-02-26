#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");

function sha256File(p){
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main(){
  const specFile = "core/spec/admin_api_spec_v0.md";
  if(!fs.existsSync(specFile)) throw new Error("MISSING_SPEC: " + specFile);

  const outFile = "core/spec/admin_api_hash_v0.json";
  const sha = sha256File(specFile);

  const obj = {
    version: "admin_api_hash_v0",
    file: specFile,
    sha256: sha
  };

  fs.writeFileSync(outFile, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log("OK_ADMIN_API_HASH_V0_GEN", sha);
}

main();
