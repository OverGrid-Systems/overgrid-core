#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");

const specPath = "core/spec/command_surface_v0.json";
const hashPath = "core/spec/command_surface_hash_v0.json";

const raw = fs.readFileSync(specPath);
const sha = crypto.createHash("sha256").update(raw).digest("hex");

const out = {
  version: "command_surface_hash_v0",
  inputs: [specPath],
  expectedSha256: sha
};

fs.writeFileSync(hashPath, JSON.stringify(out, null, 2));
console.log("OK_GEN_COMMAND_SURFACE_HASH_V0", sha);
