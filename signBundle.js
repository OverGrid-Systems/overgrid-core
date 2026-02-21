// Usage:
//   node signBundle.js dist_proof_bundle_onefile/bundle.json keys/private.pem
// Output:
//   dist_proof_bundle_onefile/bundle.sig (hex)

import fs from "fs";
import crypto from "crypto";

const [bundlePath, privPemPath] = process.argv.slice(2);
if (!bundlePath || !privPemPath) {
  console.error("Usage: node signBundle.js <bundle.json> <private.pem>");
  process.exit(2);
}

const bundleBytes = fs.readFileSync(bundlePath);
const privPem = fs.readFileSync(privPemPath, "utf8");
const privKey = crypto.createPrivateKey(privPem);

// Sign the raw bytes of bundle.json (not parsed JSON)
const sig = crypto.sign(null, bundleBytes, privKey).toString("hex");

fs.writeFileSync(bundlePath.replace(/bundle\.json$/, "bundle.sig"), sig);
console.log("Signed OK -> bundle.sig");
