const fs = require("fs");
const crypto = require("crypto");

const specPath = "core/spec/sim_spec_v1.md";
const contractPath = "core/spec/sim_contract_hash_v1.json";

const content = fs.readFileSync(specPath);
const hash = crypto.createHash("sha256").update(content).digest("hex");

const contract = JSON.parse(fs.readFileSync(contractPath));
contract.expectedSha256 = hash;

fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2));
console.log("OK_SIM_CONTRACT_HASH_V1", hash);
