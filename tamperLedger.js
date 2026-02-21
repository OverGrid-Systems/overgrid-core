import fs from "fs";

const mode = process.argv[2]; // "chain" | "sig"
if (mode !== "chain" && mode !== "sig") {
  console.error("Usage: node tamperLedger.js chain|sig");
  process.exit(2);
}

const ledger = JSON.parse(fs.readFileSync("ledger.json", "utf8"));
if (!Array.isArray(ledger) || ledger.length === 0) {
  console.error("ledger.json invalid");
  process.exit(2);
}

if (mode === "chain") {
  const s = String(ledger[0].chainHash);
  const flip = s[0] === "0" ? "1" : "0";
  ledger[0].chainHash = flip + s.slice(1);
  fs.writeFileSync("ledger.chain.tampered.json", JSON.stringify(ledger, null, 2));
  console.log("Wrote ledger.chain.tampered.json", "orig0=", s[0], "new0=", flip);
}

if (mode === "sig") {
  const s = String(ledger[0].signature);
  const flip = s[0] === "0" ? "1" : "0";
  ledger[0].signature = flip + s.slice(1);
  fs.writeFileSync("ledger.sig.tampered.json", JSON.stringify(ledger, null, 2));
  console.log("Wrote ledger.sig.tampered.json", "orig0=", s[0], "new0=", flip);
}
