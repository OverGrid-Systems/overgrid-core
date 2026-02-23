const fs = require("fs");
const crypto = require("crypto");

const SPEC_PATH = "core/spec/contract_hash_v0.json";
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));

if (!Array.isArray(spec.inputs) || spec.inputs.length === 0) {
  throw new Error("MISSING_INPUTS_IN_SPEC");
}

const pieces = [];
for (const p of spec.inputs) {
  if (!fs.existsSync(p)) throw new Error("MISSING_INPUT_FILE: " + p);
  const buf = fs.readFileSync(p);
  pieces.push(Buffer.from(`FILE:${p}\nSIZE:${buf.length}\n`));
  pieces.push(buf);
  pieces.push(Buffer.from("\n---\n"));
}

const hash = crypto.createHash("sha256").update(Buffer.concat(pieces)).digest("hex");
spec.expectedSha256 = hash;

fs.writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n", "utf8");
console.log("OK_CONTRACT_HASH_V0", hash);
