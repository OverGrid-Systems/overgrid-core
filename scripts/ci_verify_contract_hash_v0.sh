#!/usr/bin/env bash
set -euo pipefail

SPEC="core/spec/contract_hash_v0.json"
test -f "$SPEC"

node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");

const SPEC_PATH = "core/spec/contract_hash_v0.json";
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));

const expected = String(spec.expectedSha256 || "");
if (!/^[0-9a-f]{64}$/.test(expected)) {
  throw new Error("BAD_OR_EMPTY_expectedSha256 (run: node scripts/gen_contract_hash_v0.cjs)");
}

const pieces = [];
for (const p of spec.inputs) {
  if (!fs.existsSync(p)) throw new Error("MISSING_INPUT_FILE: " + p);
  const buf = fs.readFileSync(p);
  pieces.push(Buffer.from(`FILE:${p}\nSIZE:${buf.length}\n`));
  pieces.push(buf);
  pieces.push(Buffer.from("\n---\n"));
}

const got = crypto.createHash("sha256").update(Buffer.concat(pieces)).digest("hex");
if (got !== expected) {
  throw new Error("CONTRACT_HASH_MISMATCH\nexpected=" + expected + "\ngot=" + got);
}

console.log("OK_CONTRACT_HASH_V0", got);
NODE
