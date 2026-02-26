"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(bufOrStr){
  return crypto.createHash("sha256").update(bufOrStr).digest("hex");
}
function nowIso(){ return new Date().toISOString(); }

// deterministic key-sorted stringify (no deps)
function stableStringify(x){
  if(x === null) return "null";
  const t = typeof x;
  if(t === "number" || t === "boolean") return JSON.stringify(x);
  if(t === "string") return JSON.stringify(x);
  if(Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  if(t === "object"){
    const keys = Object.keys(x).sort();
    return "{" + keys.map(k => JSON.stringify(k)+":"+stableStringify(x[k])).join(",") + "}";
  }
  return JSON.stringify(String(x));
}

function main(){
  const draftsDir = path.join("admin","llm","drafts_v0");
  if(!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, {recursive:true});

  const intent = (process.argv[2] || "docs").trim();
  const target = (process.argv[3] || "core/spec/mass_sim_v0/llm_admin_control_surface_v0.md").trim();

  // hard validation: target must exist + be a file
  if(!fs.existsSync(target) || !fs.statSync(target).isFile()){
    console.error(`FATAL_LLM_DRAFT_TARGET_MISSING ${target}`);
    process.exit(2);
  }

  const id = "d_" + crypto.randomBytes(10).toString("hex");
  const createdAt = nowIso();

  const targetBytes = fs.readFileSync(target);
  const inputHash = sha256(targetBytes);

  // build draft with outputHash placeholder first
  const draft = {
    version: "llm_draft_v0",
    id,
    createdAt,
    intent,
    target,
    proposal: {
      summary: "DRAFT ONLY — fill in proposal details",
      changes: []
    },
    constraints: {
      deterministic: true,
      draftOnly: true,
      requiresHumanApproval: true
    },
    provenance: {
      source: "human",
      model: "n/a",
      promptHash: "unknown",
      inputHash,
      outputHash: "PENDING"
    }
  };

  // deterministic outputHash over canonical JSON (with outputHash blanked)
  const canonForHash = Object.assign({}, draft, {
    provenance: Object.assign({}, draft.provenance, { outputHash: "" })
  });
  const outputHash = sha256(stableStringify(canonForHash));

  draft.provenance.outputHash = outputHash;

  const outPath = path.join(draftsDir, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2) + "\n", "utf8");
  process.stdout.write(`OK_LLM_DRAFT_NEW ${id} ${outPath}\n`);
  process.stdout.write(`OK_LLM_DRAFT_HASH ${id} input=${inputHash} output=${outputHash}\n`);
}

main();
