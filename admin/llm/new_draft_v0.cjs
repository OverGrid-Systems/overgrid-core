#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256(s){ return crypto.createHash("sha256").update(s).digest("hex"); }

function nowIso(){ return new Date().toISOString(); }

function main(){
  const draftsDir = path.join("admin","llm","drafts_v0");
  if(!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, {recursive:true});

  const intent = (process.argv[2] || "docs").trim();
  const target = (process.argv[3] || "core/spec/mass_sim_v0/llm_admin_control_surface_v0.md").trim();

  const id = "d_" + crypto.randomBytes(10).toString("hex");
  const createdAt = nowIso();

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
      inputHash: "unknown",
      outputHash: sha256(JSON.stringify({intent,target,createdAt}, null, 2))
    }
  };

  const outPath = path.join(draftsDir, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2) + "\n", "utf8");
  process.stdout.write(`OK_LLM_DRAFT_NEW ${id} ${outPath}\n`);
}

main();
