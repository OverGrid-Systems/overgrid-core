const fs = require("fs");
const crypto = require("crypto");

const p = "core/dist/unit_art_registry_v0.json";
if(!fs.existsSync(p)){
  console.error("MISSING_UNIT_ART_REGISTRY_V0");
  process.exit(1);
}
const data = fs.readFileSync(p);
const hash = crypto.createHash("sha256").update(data).digest("hex");

const out = { version: "unit_art_registry_hash_v0", file: p, sha256: hash };

fs.mkdirSync("core/spec", { recursive: true });
fs.writeFileSync("core/spec/unit_art_registry_hash_v0.json", JSON.stringify(out, null, 2) + "\n");
console.log("OK_UNIT_ART_REGISTRY_HASH_V0_GEN", hash);
