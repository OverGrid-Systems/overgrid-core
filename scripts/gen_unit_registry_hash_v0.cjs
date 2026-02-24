#!/usr/bin/env node
const fs=require("fs");
const crypto=require("crypto");

const json=fs.readFileSync("core/dist/unit_registry_v0.json");
const hash=crypto.createHash("sha256").update(json).digest("hex");

const lock={
  version:"unit_registry_hash_v0",
  file:"core/dist/unit_registry_v0.json",
  sha256:hash
};

fs.writeFileSync(
  "core/spec/unit_registry_hash_v0.json",
  JSON.stringify(lock,null,2)+"\n"
);

console.log("OK_UNIT_REGISTRY_HASH_V0_GEN",hash);
