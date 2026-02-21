// Usage:
//   node verifySignedBundle.js dist_proof_bundle_onefile/bundle.json dist_proof_bundle_onefile/bundle.sig dist_proof_bundle_onefile/public.pem

import fs from "fs";
import crypto from "crypto";

const [bundlePath, sigPath, pubPemPath] = process.argv.slice(2);
if (!bundlePath || !sigPath || !pubPemPath) {
  console.error("Usage: node verifySignedBundle.js <bundle.json> <bundle.sig> <public.pem>");
  process.exit(2);
}

const bundleBytes = fs.readFileSync(bundlePath);
const sigHex = fs.readFileSync(sigPath, "utf8").trim();
const pubPem = fs.readFileSync(pubPemPath, "utf8");
const pubKey = crypto.createPublicKey(pubPem);

const ok = crypto.verify(null, bundleBytes, pubKey, Buffer.from(sigHex, "hex"));
if (!ok) {
  console.error("VERIFY FAILED: bundle signature invalid");
  process.exit(1);
}

console.log("VERIFY OK: bundle signature valid");
