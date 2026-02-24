const fs = require("fs");
const crypto = require("crypto");

const p = "docs/LOCKS.md";
if (!fs.existsSync(p)) {
  console.error("MISSING_LOCKS_MD");
  process.exit(1);
}

const data = fs.readFileSync(p);
const hash = crypto.createHash("sha256").update(data).digest("hex");

const out = {
  version: "locks_md_hash_v1",
  file: p,
  sha256: hash
};

fs.mkdirSync("core/spec", { recursive: true });
fs.writeFileSync("core/spec/locks_md_hash_v1.json", JSON.stringify(out, null, 2) + "\n");
console.log("OK_LOCKS_MD_HASH_V1_GEN", hash);
